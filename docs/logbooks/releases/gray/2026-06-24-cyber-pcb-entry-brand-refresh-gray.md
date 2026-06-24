# Cyber PCB Entry Brand Refresh Gray Release - 2026-06-24

## 发布目标

- 将无限画布 2.0 的登录页、启动过渡页、空画布等待页和工作区左上品牌区统一切换到新的 Cyber PCB 视觉语言。
- 保持现有登录、鉴权、创建画布和工作区加载链路不变，只替换前端视觉壳层、共享样式和品牌资源。
- 以新版本 `v0.5.1` 完成一轮 gray 放行，交由用户执行真实页面观感与交互体验验收。

## 发布信息

- 环境：`gray`
- 版本：`v0.5.1`
- release：`20260624-cyber-pcb-entry-brand-refresh-gray-r2-v051`
- 上一灰度 release：`20260624-cyber-pcb-entry-brand-refresh-gray-r1-v0418`

## Agent 已验证

### 本地代码与 contract

- `node scripts/verify-cyber-entry-brand-contract.mjs`
- `npm run type-check -w @xinghuan/web`
- `npm run build -w @xinghuan/web`
- `codegraph sync`

### 结构收口结果

- `apps/web/src/components/LoginGate.tsx`
  - 保留职责：邮箱/密码表单、提交态、报错、`api.login` 登录成功回调
  - 本轮替换为：左侧大 logo 主视觉 + 右侧硬边 Cyber PCB 控制台登录面板
- `apps/web/src/App.tsx`
  - 保留职责：`authStatus === 'checking'` 启动态、工作区壳层与顶部状态栏
  - 本轮替换为：
    - 居中的 Cyber PCB 启动过渡面板
    - 左上角统一 `xh-cyber-brand-lockup` 品牌区
- `apps/web/src/components/Canvas.tsx`
  - 保留职责：`!activeId` 空态判断与 `createCanvas(...)` 触发
  - 本轮替换为：深色 PCB 背景 + 中间单卡牌空态
- `apps/web/src/styles/index.css`
  - 新增 `xh-cyber-*` 共享样式层，承载登录页、过渡页、空态页和品牌区的统一视觉语言

## 本次实际放行证据

- prepare：
  - `npm run release:gray:prepare:runninghub -- --release=20260624-cyber-pcb-entry-brand-refresh-gray-r2-v051`
  - 归档包：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-cyber-pcb-entry-brand-refresh-gray-r2-v051.tar.gz`
  - 包大小：`5.49 MB`
  - 临时 staging：`C:\Users\Administrator\AppData\Local\Temp\xinghuan-release-mJ1W6k`
- deploy：
  - `npm run release:gray:deploy -- --release=20260624-cyber-pcb-entry-brand-refresh-gray-r2-v051 --archive="D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-cyber-pcb-entry-brand-refresh-gray-r2-v051.tar.gz" --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem"`
- verify：
  - `npm run release:gray:verify -- --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem" --expected-version=0.5.1 --expected-environment=gray`
- 远端 current release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-cyber-pcb-entry-brand-refresh-gray-r2-v051`
- 远端服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 远端状态接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
  - 两者均返回：
    - `version = 0.5.1`
    - `environment = gray`
    - `dataDir = /opt/apps/xinghuan-canvas-next/shared/data`

## 待用户验收

### 视觉验收

- 登录页新的 Logo、扫描线、面板边角和按钮观感
- 启动过渡页居中动画与进度层次
- 空画布等待页的卡牌层级、背景氛围和文案观感
- 工作区左上角品牌区在不同主题下的观感与密度

### 真实交互体验

- 账号密码登录体验是否正常
- 启动过渡页到工作区切换是否自然
- 空画布创建第一张星图是否保持原有行为

## 风险与残留问题

- 本轮只替换四块入口视觉壳层，没有改 API / worker / store 逻辑。
- 旧的星云入口样式仍保留在 `index.css` 中作为兼容层，后续如继续推进全站主题统一，可再按批次清理。

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-cyber-pcb-entry-brand-refresh-gray-r1-v0418`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的页面：
  - 登录页
  - 启动过渡页
  - 空画布等待页
  - 工作区顶部左上品牌区
