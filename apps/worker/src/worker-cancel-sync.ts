interface WorkerCancelTrace {
  taskId: string;
  capability: string;
  trace: Record<string, unknown>;
}

interface WorkerCancelLifecycleDelegate {
  dropCancelledAttempt: (input: WorkerCancelTrace & { line: string; message: string }) => Promise<void>;
  keepCancelledState: (input: WorkerCancelTrace & { line: string; message: string }) => Promise<void>;
}

interface CreateWorkerCancelSyncOptions extends WorkerCancelLifecycleDelegate {
  isTaskCancelled: (taskId: string) => Promise<boolean>;
  logWorkerEvent: (event: string, payload: Record<string, unknown>) => void;
}

interface HandleCancelledClaimInput extends WorkerCancelTrace {
  claimResult: "updated" | "cancelled" | "missing";
  onCancelled: () => Promise<void>;
}

interface KeepCancelledStateInput extends WorkerCancelTrace {
  outcome: "updated" | "cancelled" | "missing";
  line: string;
  message: string;
}

export function createWorkerCancelSync(options: CreateWorkerCancelSyncOptions) {
  async function handleCancelledClaim(input: HandleCancelledClaimInput) {
    if (input.claimResult !== "cancelled") return false;
    await input.onCancelled();
    options.logWorkerEvent("task.skipped", {
      ...input.trace,
      taskId: input.taskId,
      status: "cancelled",
      message: "cancel_requested before claim",
    });
    return true;
  }

  async function dropResultIfCancelled(input: WorkerCancelTrace) {
    if (!(await options.isTaskCancelled(input.taskId))) return false;
    await options.dropCancelledAttempt({
      ...input,
      line: "检测到任务已取消，丢弃执行结果",
      message: "cancel_requested drop result after cancellation",
    });
    return true;
  }

  async function dropErrorIfCancelled(input: WorkerCancelTrace) {
    if (!(await options.isTaskCancelled(input.taskId))) return false;
    await options.dropCancelledAttempt({
      ...input,
      line: "检测到任务已取消，丢弃执行错误",
      message: "cancel_requested drop error after cancellation",
    });
    return true;
  }

  async function keepCompletionCancelledState(input: Omit<KeepCancelledStateInput, "line" | "message">) {
    return keepCancelledStateIfNeeded({
      ...input,
      line: "检测到任务已取消，保留取消状态",
      message: "completion kept cancelled state",
    });
  }

  async function keepRetryCancelledState(input: Omit<KeepCancelledStateInput, "line" | "message">) {
    return keepCancelledStateIfNeeded({
      ...input,
      line: "检测到任务已取消，保留取消状态",
      message: "retry kept cancelled state",
    });
  }

  async function keepCancelledStateIfNeeded(input: KeepCancelledStateInput) {
    if (input.outcome !== "cancelled") return false;
    await options.keepCancelledState({
      taskId: input.taskId,
      capability: input.capability,
      trace: input.trace,
      line: input.line,
      message: input.message,
    });
    return true;
  }

  return {
    dropErrorIfCancelled,
    dropResultIfCancelled,
    handleCancelledClaim,
    keepCompletionCancelledState,
    keepRetryCancelledState,
  };
}
