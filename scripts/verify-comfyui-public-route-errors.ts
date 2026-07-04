import assert from "node:assert/strict";
import { formatComfyuiExecutionError } from "../apps/api/src/comfyui-execution.ts";

const unreachableMessage = formatComfyuiExecutionError(
  new TypeError("fetch failed"),
  { stage: "prompt_submit", instanceName: "Local ComfyUI", workflowTitle: "TTP 放大工作流" },
);

assert.match(
  unreachableMessage,
  /Local ComfyUI/,
  "translated comfyui error should mention the selected machine",
);
assert.match(
  unreachableMessage,
  /TTP 放大工作流/,
  "translated comfyui error should mention the active workflow",
);
assert.match(
  unreachableMessage,
  /无法连接|连接失败|fetch failed/i,
  "translated comfyui error should explain that the machine is unreachable",
);

const historyMessage = formatComfyuiExecutionError(
  new Error("ComfyUI history 查询失败: 502"),
  { stage: "history_poll", instanceName: "Local ComfyUI", workflowTitle: "TTP 放大工作流" },
);

assert.match(
  historyMessage,
  /结果|history|输出/i,
  "history poll failure should mention output retrieval semantics",
);

console.log("comfyui public route errors: ok");
