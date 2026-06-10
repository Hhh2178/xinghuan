# Login Security Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉登录页预填管理员账号，修复当前本地默认账号暴露的安全问题，同时保留本地/灰度可登录性。

**Architecture:** 登录页只保留空输入与占位提示，不再把 bootstrap 管理员邮箱直接渲染到前端。验收脚本继续验证管理员可登录，但不再要求页面预填任何值。

**Tech Stack:** React 19, Vite, existing auth API, contract verification scripts

---

### Task 1: 增加登录页空输入契约

**Files:**
- Create: `scripts/verify-login-gate-security-contract.mjs`
- Modify: `scripts/verify-admin-auth-passwords.mjs`

- [ ] **Step 1: 写失败契约**

```js
import { readFile } from "node:fs/promises";

async function main() {
  const source = await readFile(new URL("../apps/web/src/components/LoginGate.tsx", import.meta.url), "utf8");
  const checks = [
    [
      "Login gate does not prefill bootstrap admin email",
      !source.includes("useState('admin@xinghuan.local')"),
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

- [ ] **Step 2: 运行契约确认失败**

Run: `node scripts/verify-login-gate-security-contract.mjs`
Expected: FAIL。

### Task 2: 去掉预填管理员邮箱

**Files:**
- Modify: `apps/web/src/components/LoginGate.tsx`

- [ ] **Step 1: 改为空输入初始值**

```tsx
const [email, setEmail] = useState("");
```

- [ ] **Step 2: 保留按钮禁用条件，不引入自动填充回退**

```tsx
disabled={submitting || !email || !password}
```

- [ ] **Step 3: 运行安全契约和现有认证契约**

Run:
- `node scripts/verify-login-gate-security-contract.mjs`
- `npm run verify:admin-auth-passwords`

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-login-gate-security-contract.mjs apps/web/src/components/LoginGate.tsx scripts/verify-admin-auth-passwords.mjs
git commit -m "fix: remove prefilled admin email from login gate"
```
