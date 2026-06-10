# Generation Node Runtime Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为生成类节点补统一的左上角运行态卡片，显示实时进度、已耗时和最终统计，并保证后续同类节点可复用。

**Architecture:** 提炼一个节点级运行态卡片组件，由生成节点传入 `status/progress/startedAt/finishedAt` 等元数据。执行链路在启动与完成节点任务时记录时间戳，UI 通过共享组件渲染进度条和耗时。

**Tech Stack:** React 19, shared node data types, web node components, single-port worker/task runtime

---

### Task 1: 契约化当前缺口

**Files:**
- Create: `scripts/verify-node-runtime-card-contract.mjs`

- [ ] **Step 1: 写失败契约**

```js
import { readFile } from "node:fs/promises";

async function main() {
  const [image, video, audio] = await Promise.all([
    readFile(new URL("../apps/web/src/components/nodes/ImageNode.tsx", import.meta.url), "utf8").catch(() => ""),
    readFile(new URL("../apps/web/src/components/nodes/VideoNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/nodes/PlaceholderNode.tsx", import.meta.url), "utf8"),
  ]);

  const merged = `${image}\n${video}\n${audio}`;
  const checks = [
    [
      "Generation nodes render shared runtime card hook or component",
      merged.includes("NodeRuntimeCard") || merged.includes("node-runtime-card"),
    ],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (failed.length > 0) process.exit(1);
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 2: 运行红测**

Run: `node scripts/verify-node-runtime-card-contract.mjs`
Expected: FAIL。

### Task 2: 定义运行态数据与共享组件

**Files:**
- Create: `apps/web/src/components/nodes/NodeRuntimeCard.tsx`
- Modify: `apps/web/src/styles/index.css`
- Modify: `packages/model-core/src/index.ts`
- Modify: 生成节点对应类型定义文件

- [ ] **Step 1: 定义共享运行态字段**

```ts
export interface GenerationRuntimeMeta {
  progress?: number;
  startedAt?: number;
  finishedAt?: number;
  lastDurationMs?: number;
  status?: "idle" | "running" | "success" | "error";
}
```

- [ ] **Step 2: 实现卡片组件**

```tsx
export function NodeRuntimeCard({ progress = 0, startedAt, finishedAt, status }: Props) {
  const elapsedMs = finishedAt && startedAt ? finishedAt - startedAt : startedAt ? Date.now() - startedAt : 0;
  return (
    <div className="node-runtime-card">
      <strong>{status === "running" ? "生成中" : status === "success" ? "已完成" : status === "error" ? "失败" : "待执行"}</strong>
      <span>{Math.round(progress)}%</span>
      <small>{formatElapsed(elapsedMs)}</small>
    </div>
  );
}
```

### Task 3: 在执行链路记录开始/结束时间

**Files:**
- Modify: `apps/web/src/services/generation.ts`
- Modify: `apps/web/src/components/nodes/VideoNode.tsx`
- Modify: `apps/web/src/components/nodes/PlaceholderNode.tsx`
- Modify: 其他生成节点文件

- [ ] **Step 1: 启动生成时写入 `startedAt` 与 `progress=0`**
- [ ] **Step 2: 成功完成时写入 `finishedAt` 与 `lastDurationMs`**
- [ ] **Step 3: 失败时保留 `finishedAt` 便于显示终态耗时**

### Task 4: 在所有生成类节点挂载卡片并验收

**Files:**
- Modify: 所有生成类节点组件

- [ ] **Step 1: 左上角挂共享卡片**
- [ ] **Step 2: 运行契约与节点烟雾脚本**

Run:
- `node scripts/verify-node-runtime-card-contract.mjs`
- `npm run verify:canvas-node-render-smoke`

- [ ] **Step 3: 浏览器验收**

Run:
- 触发一个图像节点生成
- 确认左上角卡片实时显示进度与耗时
- 完成后确认终态时长保留

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-node-runtime-card-contract.mjs apps/web/src/components/nodes apps/web/src/styles/index.css packages/model-core/src/index.ts
git commit -m "feat: add runtime cards to generation nodes"
```
