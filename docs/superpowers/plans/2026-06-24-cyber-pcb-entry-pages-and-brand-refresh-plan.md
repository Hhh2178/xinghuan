# Cyber PCB Entry Pages And Brand Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改登录、启动和创建画布逻辑的前提下，把登录页、启动过渡页、空画布等待页和左上角品牌区整体替换为新的 Cyber PCB 视觉语言。

**Architecture:** 保留现有状态机、接口和行为函数，只重写四块视觉壳层，并新增一组独立的 `xh-cyber-*` 样式与品牌资源。先用前端契约脚本锁定设计边界，再逐页替换 JSX 和 CSS，最后补台账并做 `web` 构建验证。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind utilities、项目现有 `node scripts/*.mjs` 契约校验脚本

---

## File Structure

### Existing files to modify

- `apps/web/src/components/LoginGate.tsx`
  - 继续承载邮箱/密码输入、提交、报错和登录成功回调。
  - 改动范围仅限登录页视觉壳层与品牌展示。
- `apps/web/src/App.tsx`
  - 继续承载 `authStatus === 'checking'` 的过渡态和工作区顶部品牌区。
  - 改动范围仅限过渡页视觉壳层和左上角品牌区 JSX。
- `apps/web/src/components/Canvas.tsx`
  - 继续承载 `!activeId` 的空画布等待态。
  - 改动范围仅限空态视觉壳层。
- `apps/web/src/styles/index.css`
  - 新增 `xh-cyber-*` 独立样式层，不大范围删除旧样式。
- `docs/logbooks/daily/2026/2026-06/2026-06-24.md`
  - 记录本轮视觉重构的实现与验证证据。

### New files to create

- `apps/web/src/assets/brand-stellar-glitch-logo.png`
  - 由用户提供的 `logo1.png` 拷贝入仓库，供登录页、过渡页和品牌区复用。
- `scripts/verify-cyber-entry-brand-contract.mjs`
  - 读取前端源码，校验四块入口视觉边界是否落地。

### Files intentionally not modified

- `apps/web/src/services/api.ts`
- `apps/web/src/stores/*`
- `apps/api/src/*`
- `apps/worker/src/*`

这些文件不参与本轮实现，避免把视觉任务扩散到业务链路。

---

### Task 1: Add a Frontend Contract For The New Entry-Shell Boundaries

**Files:**
- Create: `scripts/verify-cyber-entry-brand-contract.mjs`
- Modify: none
- Test: `scripts/verify-cyber-entry-brand-contract.mjs`

- [ ] **Step 1: Write the failing contract test**

```js
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const loginGate = await readFile(new URL("../apps/web/src/components/LoginGate.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
const canvas = await readFile(new URL("../apps/web/src/components/Canvas.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../apps/web/src/styles/index.css", import.meta.url), "utf8");

assert.match(loginGate, /brand-stellar-glitch-logo\.png/, "LoginGate should reference the new stellar glitch logo asset");
assert.match(loginGate, /xh-cyber-login-shell/, "LoginGate should render the new cyber login shell");
assert.match(app, /xh-cyber-transition-shell/, "App transition state should render the new centered cyber transition shell");
assert.match(app, /xh-cyber-brand-lockup/, "App top bar should expose the unified cyber brand lockup");
assert.match(canvas, /xh-cyber-empty-shell/, "Canvas empty state should expose the new cyber empty shell");
assert.doesNotMatch(canvas, /节点星座|素材资产库|模型目录/, "Canvas empty state should remove the three helper chips");
assert.match(styles, /\.xh-cyber-login-shell\b/, "Cyber login shell styles should exist");
assert.match(styles, /\.xh-cyber-transition-shell\b/, "Cyber transition shell styles should exist");
assert.match(styles, /\.xh-cyber-empty-shell\b/, "Cyber empty shell styles should exist");
assert.match(styles, /\.xh-cyber-brand-lockup\b/, "Cyber top brand styles should exist");

console.log("PASS cyber entry brand contract");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-cyber-entry-brand-contract.mjs`

Expected: FAIL with one or more assertions such as:

- `LoginGate should reference the new stellar glitch logo asset`
- `App transition state should render the new centered cyber transition shell`

- [ ] **Step 3: Add the failing contract file**

```bash
git add scripts/verify-cyber-entry-brand-contract.mjs
```

- [ ] **Step 4: Commit the red test**

```bash
git commit -m "test: add cyber entry brand contract"
```

---

### Task 2: Add Brand Asset And Shared Cyber PCB Style Layer

**Files:**
- Create: `apps/web/src/assets/brand-stellar-glitch-logo.png`
- Modify: `apps/web/src/styles/index.css`
- Test: `scripts/verify-cyber-entry-brand-contract.mjs`

- [ ] **Step 1: Write the minimal shared style block to satisfy the contract**

Append a new style section near the existing entry-shell styles in `apps/web/src/styles/index.css`:

```css
.xh-cyber-scanlines,
.xh-cyber-pcb-grid,
.xh-cyber-glow-orb {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.xh-cyber-login-shell,
.xh-cyber-transition-shell,
.xh-cyber-empty-shell {
  position: relative;
  isolation: isolate;
  background:
    linear-gradient(180deg, rgba(7, 9, 15, 0.96), rgba(10, 12, 18, 0.98)),
    #0b0d12;
  color: #e7fff7;
  overflow: hidden;
}

.xh-cyber-pcb-grid {
  background-image:
    linear-gradient(rgba(49, 240, 179, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(49, 240, 179, 0.06) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.42;
}

.xh-cyber-scanlines {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0) 50%,
    rgba(0, 0, 0, 0.18) 50%,
    rgba(0, 0, 0, 0.18) 100%
  );
  background-size: 100% 4px;
  opacity: 0.5;
}

.xh-cyber-brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.xh-cyber-brand-wordmark {
  display: block;
  height: 22px;
  width: auto;
  object-fit: contain;
}

.xh-cyber-corner-panel {
  position: relative;
  border: 1px solid rgba(49, 240, 179, 0.24);
  background: rgba(10, 10, 15, 0.72);
  box-shadow:
    inset 0 0 20px rgba(0, 221, 221, 0.05),
    0 18px 48px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}

.xh-cyber-corner-panel::before,
.xh-cyber-corner-panel::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(49, 240, 179, 0.88);
  pointer-events: none;
}

.xh-cyber-corner-panel::before {
  left: -1px;
  top: -1px;
  border-right: none;
  border-bottom: none;
}

.xh-cyber-corner-panel::after {
  right: -1px;
  bottom: -1px;
  border-left: none;
  border-top: none;
}
```

- [ ] **Step 2: Copy the user-provided logo into the web asset directory**

Run:

```powershell
Copy-Item -LiteralPath "C:\Users\Administrator\Downloads\logo1.png" -Destination "D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\apps\web\src\assets\brand-stellar-glitch-logo.png"
```

Expected: command exits 0 and the new file exists at `apps/web/src/assets/brand-stellar-glitch-logo.png`.

- [ ] **Step 3: Run the contract test and verify it still fails on JSX usage**

Run: `node scripts/verify-cyber-entry-brand-contract.mjs`

Expected: FAIL, but only for JSX assertions such as:

- `LoginGate should render the new cyber login shell`
- `App top bar should expose the unified cyber brand lockup`

The style assertions should now pass.

- [ ] **Step 4: Commit the asset and shared style foundation**

```bash
git add apps/web/src/assets/brand-stellar-glitch-logo.png apps/web/src/styles/index.css
git commit -m "feat: add cyber pcb entry style foundation"
```

---

### Task 3: Replace LoginGate With The New Cyber PCB Login Shell

**Files:**
- Modify: `apps/web/src/components/LoginGate.tsx`
- Test: `scripts/verify-cyber-entry-brand-contract.mjs`

- [ ] **Step 1: Rewrite the login shell while preserving submit logic**

Replace the visual shell in `LoginGate.tsx` with a new layout that imports the logo asset and keeps the existing state/handlers:

```tsx
import stellarGlitchLogo from "../assets/brand-stellar-glitch-logo.png";

return (
  <div className="xh-cyber-login-shell min-h-[100dvh] text-[#e7fff7]">
    <div className="xh-cyber-pcb-grid" aria-hidden="true" />
    <div className="xh-cyber-scanlines" aria-hidden="true" />
    <main className="relative z-10 grid min-h-[100dvh] grid-cols-1 items-center gap-10 px-6 py-8 lg:grid-cols-[1.05fr_520px] lg:px-16">
      <section className="flex items-center justify-center lg:justify-start">
        <img
          src={stellarGlitchLogo}
          alt="星幻"
          className="max-w-[min(44vw,560px)] w-full object-contain drop-shadow-[0_0_26px_rgba(49,240,179,0.28)]"
        />
      </section>

      <section className="flex justify-center lg:justify-end">
        <form onSubmit={handleSubmit} className="xh-cyber-corner-panel w-full max-w-[520px] px-8 py-9">
          <div className="mb-8">
            <div className="text-[12px] font-semibold tracking-[0.22em] text-[#31f0b3]">系统访问</div>
            <div className="mt-4 h-px w-20 bg-[#31f0b3]" />
          </div>

          <label className="mb-8 block">
            <span className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#31f0b3]">账号邮箱</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="请输入邮箱地址"
              type="email"
              className="h-18 w-full border border-[#5a6a66] bg-[#0e1117] px-5 text-[16px] text-[#e7fff7] outline-none transition focus:border-[#31f0b3]"
            />
          </label>

          <label className="mb-8 block">
            <span className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#31f0b3]">访问密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="请输入密码"
              type="password"
              className="h-18 w-full border border-[#5a6a66] bg-[#0e1117] px-5 text-[16px] text-[#e7fff7] outline-none transition focus:border-[#31f0b3]"
            />
          </label>

          {error ? <div className="mb-6 border border-red-500/35 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div> : null}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="flex h-16 w-full items-center justify-center gap-3 bg-[#31f0b3] text-[20px] font-black text-black disabled:opacity-60"
          >
            <span>登录</span>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
          </button>

          <div className="mt-8 flex items-center justify-end gap-2 text-[12px] tracking-[0.18em] text-[#31f0b3]">
            <span className="h-2 w-2 rounded-full bg-[#31f0b3]" />
            <span>节点就绪</span>
          </div>
        </form>
      </section>
    </main>
  </div>
);
```

- [ ] **Step 2: Run the contract test to verify login assertions pass**

Run: `node scripts/verify-cyber-entry-brand-contract.mjs`

Expected: login-related assertions pass, while transition/empty-shell assertions may still fail.

- [ ] **Step 3: Run a focused type check**

Run: `npm run type-check -w @xinghuan/web`

Expected: PASS

- [ ] **Step 4: Commit the login page conversion**

```bash
git add apps/web/src/components/LoginGate.tsx
git commit -m "feat: restyle login gate with cyber pcb shell"
```

---

### Task 4: Replace The Centered Transition Shell And Top-Left Brand Lockup

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `scripts/verify-cyber-entry-brand-contract.mjs`

- [ ] **Step 1: Replace the auth checking transition markup**

In the `if (authStatus === 'checking')` branch, replace the current orbit-heavy layout with a centered logo + weak sync layer:

```tsx
import stellarGlitchLogo from "./assets/brand-stellar-glitch-logo.png";

return (
  <div className="xh-cyber-transition-shell flex h-screen items-center justify-center overflow-hidden text-[#e7fff7]">
    <div className="xh-cyber-pcb-grid" aria-hidden="true" />
    <div className="xh-cyber-scanlines" aria-hidden="true" />
    <main className="relative z-10 flex w-full max-w-[920px] flex-col items-center justify-center px-6 text-center">
      <img
        src={stellarGlitchLogo}
        alt="星幻"
        className="h-auto w-[min(52vw,420px)] object-contain drop-shadow-[0_0_30px_rgba(49,240,179,0.24)]"
      />
      <div className="xh-cyber-corner-panel mt-10 w-full max-w-[520px] px-8 py-7">
        <div className="text-[12px] font-semibold tracking-[0.22em] text-[#31f0b3]">SYSTEM BOOTSTRAP</div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[15px] text-[#bacac0]">
          <span className="h-2 w-2 rounded-full bg-[#31f0b3] animate-pulse" />
          <span>节点同步中 / 权限校验完成后进入工作区</span>
        </div>
        <div className="mt-6 grid grid-cols-5 gap-2">
          <span className="h-2 bg-[#31f0b3]" />
          <span className="h-2 bg-[#31f0b3]/80" />
          <span className="h-2 bg-[#31f0b3]/60" />
          <span className="h-2 bg-[#31f0b3]/40" />
          <span className="h-2 bg-[#31f0b3]/20" />
        </div>
      </div>
    </main>
  </div>
);
```

- [ ] **Step 2: Replace the top-left brand block inside the main header**

In the logged-in header branch, remove the per-theme brand variants and replace the left brand block with a unified lockup:

```tsx
<div className="xh-cyber-brand-lockup min-w-0">
  <img
    src={stellarGlitchLogo}
    alt="星幻"
    className="xh-cyber-brand-wordmark shrink-0"
  />
  <div className="flex items-center gap-2">
    <span className="rounded border border-[#31f0b3]/30 bg-[#11161d] px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[#31f0b3]">
      v{__APP_VERSION__}
    </span>
    <span className="text-[11px] tracking-[0.16em] text-[#88a7a3]">SYSTEM READY</span>
  </div>
</div>
```

- [ ] **Step 3: Run the contract test to verify transition and brand assertions pass**

Run: `node scripts/verify-cyber-entry-brand-contract.mjs`

Expected: only the empty-shell assertion may still fail.

- [ ] **Step 4: Run the focused type check**

Run: `npm run type-check -w @xinghuan/web`

Expected: PASS

- [ ] **Step 5: Commit the transition and top-brand conversion**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: restyle entry transition and top brand"
```

---

### Task 5: Replace The Empty Canvas Waiting Shell

**Files:**
- Modify: `apps/web/src/components/Canvas.tsx`
- Test: `scripts/verify-cyber-entry-brand-contract.mjs`

- [ ] **Step 1: Replace the `!activeId` empty-state block**

Rewrite only the empty-state return branch:

```tsx
if (!activeId) {
  return (
    <div className="t8-canvas-shell xh-cyber-empty-shell relative flex flex-1 items-center justify-center overflow-hidden">
      <div className="xh-cyber-pcb-grid" aria-hidden="true" />
      <div className="xh-cyber-scanlines" aria-hidden="true" />
      <div className="relative z-10 flex w-full items-center justify-center px-6">
        <div className="xh-cyber-corner-panel w-full max-w-[840px] px-8 py-10 text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[24px] border-2 border-[#3a4446] bg-[#171a20] shadow-[0_0_16px_rgba(190,255,224,0.08)]">
            <Orbit size={34} className="text-[#beffe0]" />
          </div>
          <h2 className="text-[44px] font-black tracking-tight text-[#f2fff8]">开启第一张星图</h2>
          <p className="mx-auto mt-6 max-w-[560px] text-[18px] leading-9 text-[#88a7a3]">
            从空白画布、图像生成或视频生成开始，这里会成为你的节点星座、素材资产库和任务历史入口。
          </p>
          <button
            type="button"
            onClick={() => createCanvas(`星图画布 ${canvases.length + 1}`)}
            className="mx-auto mt-10 flex h-16 items-center justify-center gap-3 bg-[#beffe0] px-10 text-[22px] font-black text-[#10151a]"
          >
            <Sparkles size={18} />
            <span>+ 创建星图画布</span>
          </button>
          <div className="mt-10 border-t border-[#1f3b34] pt-6 text-[14px] tracking-[0.24em] text-[#bacac0]">
            <span className="inline-flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-[#00dddd] shadow-[0_0_8px_rgba(0,221,221,0.9)]" />
              SYSTEM READY // WAITING FOR INPUT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify that the old helper chips are gone**

Run: `node scripts/verify-cyber-entry-brand-contract.mjs`

Expected: PASS with no `节点星座|素材资产库|模型目录` matches left in the empty-state branch.

- [ ] **Step 3: Run the focused type check**

Run: `npm run type-check -w @xinghuan/web`

Expected: PASS

- [ ] **Step 4: Commit the empty-canvas conversion**

```bash
git add apps/web/src/components/Canvas.tsx
git commit -m "feat: restyle empty canvas waiting shell"
```

---

### Task 6: Run Full Web Verification And Record The Change

**Files:**
- Modify: `docs/logbooks/daily/2026/2026-06/2026-06-24.md`
- Test: `scripts/verify-cyber-entry-brand-contract.mjs`

- [ ] **Step 1: Run the full contract test**

Run: `node scripts/verify-cyber-entry-brand-contract.mjs`

Expected: `PASS cyber entry brand contract`

- [ ] **Step 2: Run the final web type check**

Run: `npm run type-check -w @xinghuan/web`

Expected: PASS

- [ ] **Step 3: Run the final web build**

Run: `npm run build -w @xinghuan/web`

Expected: Vite build completes successfully with exit code 0.

- [ ] **Step 4: Record the work in the daily log**

Append a section like this to `docs/logbooks/daily/2026/2026-06/2026-06-24.md`:

```md
## Cyber PCB 入口页与品牌区视觉重构

目标:
- 在不改登录、过渡、创建画布逻辑的前提下，把登录页、启动过渡页、空画布等待页和左上角品牌区切换到新的赛博 PCB 视觉语言。

变更:
- 新增：
  - `apps/web/src/assets/brand-stellar-glitch-logo.png`
  - `scripts/verify-cyber-entry-brand-contract.mjs`
- 修改：
  - `apps/web/src/components/LoginGate.tsx`
  - `apps/web/src/App.tsx`
  - `apps/web/src/components/Canvas.tsx`
  - `apps/web/src/styles/index.css`

验证:
- `node scripts/verify-cyber-entry-brand-contract.mjs`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`

结果:
- 登录页、过渡页、空画布等待页与顶部左上角品牌区已切换到新的 Cyber PCB 风格
- 登录、启动过渡与创建画布逻辑保持不变
```

- [ ] **Step 5: Commit the final implementation**

```bash
git add apps/web/src/assets/brand-stellar-glitch-logo.png scripts/verify-cyber-entry-brand-contract.mjs apps/web/src/components/LoginGate.tsx apps/web/src/App.tsx apps/web/src/components/Canvas.tsx apps/web/src/styles/index.css docs/logbooks/daily/2026/2026-06/2026-06-24.md
git commit -m "feat: refresh entry pages and brand with cyber pcb style"
```

---

## Self-Review

### Spec coverage

- 登录页整体换新外观：Task 3 覆盖
- 过渡页动画位于正中：Task 4 覆盖
- 过渡页采用 logo + 弱同步层：Task 4 覆盖
- 空画布页仅保留背景 + 中间卡牌 + 上方图像模块：Task 5 覆盖
- 左上角品牌区统一替换到新 logo 风格：Task 4 覆盖
- 功能逻辑不动：全部任务都只改 JSX / CSS，不改业务服务与状态流

### Placeholder scan

- 计划中无 `TODO` / `TBD`
- 所有代码修改步骤都给出了明确代码
- 所有验证步骤都给出了明确命令与预期结果

### Type consistency

- 新增资产路径统一为 `apps/web/src/assets/brand-stellar-glitch-logo.png`
- 契约脚本统一校验 `xh-cyber-login-shell` / `xh-cyber-transition-shell` / `xh-cyber-empty-shell` / `xh-cyber-brand-lockup`
- `App.tsx` 中版本号继续使用 `__APP_VERSION__`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-cyber-pcb-entry-pages-and-brand-refresh-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
