export type CanvasRevisionSyncDecision = 'ignore' | 'reload' | 'block';

export interface CanvasRevisionNotice {
  type: 'canvas-revision-saved';
  canvasId: string;
  revision: number;
  sourceId: string;
}

interface CanvasLockManager {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export function decideCanvasRevisionSync(input: {
  knownRevision: number;
  incomingRevision: number;
  hasLocalChanges: boolean;
}): CanvasRevisionSyncDecision {
  if (!Number.isFinite(input.incomingRevision) || input.incomingRevision <= input.knownRevision) return 'ignore';
  return input.hasLocalChanges ? 'block' : 'reload';
}

export async function withCanvasSaveLock<T>(
  canvasId: string,
  callback: () => Promise<T>,
  lockManager?: CanvasLockManager,
): Promise<T> {
  const browserLocks = lockManager ?? (
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: CanvasLockManager }).locks
      : undefined
  );
  if (!browserLocks?.request) return callback();
  return browserLocks.request(`xinghuan-canvas-save:${encodeURIComponent(canvasId)}`, callback);
}

export function createCanvasRevisionChannel(
  sourceId: string,
  onNotice: (notice: CanvasRevisionNotice) => void,
) {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel('xinghuan-canvas-revisions-v1');
  channel.addEventListener('message', (event: MessageEvent<CanvasRevisionNotice>) => {
    const notice = event.data;
    if (
      notice?.type !== 'canvas-revision-saved'
      || notice.sourceId === sourceId
      || !notice.canvasId
      || !Number.isFinite(notice.revision)
    ) return;
    onNotice(notice);
  });
  return {
    publish(canvasId: string, revision: number) {
      channel.postMessage({ type: 'canvas-revision-saved', canvasId, revision, sourceId } satisfies CanvasRevisionNotice);
    },
    close() {
      channel.close();
    },
  };
}
