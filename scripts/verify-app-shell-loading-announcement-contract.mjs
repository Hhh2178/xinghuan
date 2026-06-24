import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const app = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");

assert.doesNotMatch(app, /正在展开星幻工作区/, "App should no longer render the legacy workspace expansion loading copy");
assert.doesNotMatch(app, /画布、节点库和资源面板正在按需加载/, "App should no longer render the legacy workspace expansion helper copy");
assert.doesNotMatch(app, /WorkspaceShellFallback/, "App should no longer keep the legacy suspense fallback shell");
assert.match(app, /const \[workspaceShellReady, setWorkspaceShellReady\] = useState\(false\);/, "App should track workspace shell readiness before hiding the transition stage");
assert.match(app, /if \(authStatus === 'checking' \|\| bootSplashVisible \|\| \(Boolean\(currentUser\) && !workspaceShellReady\)\) \{[\s\S]*return <CyberTransitionStage \/>;[\s\S]*\}/, "App should keep the transition stage mounted until the workspace shell is ready");
assert.match(app, /<Suspense fallback=\{null\}>/, "App suspense fallback should no longer render a second fullscreen loading shell");
assert.match(app, /const utilityButtonClassName =/, "App should centralize the right-side toolbar button skin");
assert.match(app, /const announcementButtonClassName =[\s\S]*utilityButtonClassName/, "Announcement button should derive from the shared utility button family");
assert.match(app, /className=\{`\$\{announcementButtonClassName\} xh-topbar-pill--announcement`\}/, "Announcement button should reuse the right-side utility button family");
assert.match(app, /title="公告中心"[\s\S]*?title="资源库"[\s\S]*?title="生成库"/, "Announcement button should live inside the right-side utility button group");

console.log("PASS app shell loading + announcement contract");
