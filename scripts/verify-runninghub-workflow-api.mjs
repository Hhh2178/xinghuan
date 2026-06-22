import { readFile } from "node:fs/promises";

const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const sameOriginHeaders = {
  origin: baseUrl,
  referer: `${baseUrl}/`,
};
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";

let cookie = "";

async function main() {
  await verifySourceContracts();

  const login = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(login.data?.authenticated === true, "login failed");

  const catalog = await fetchJson("/api/runninghub/catalog");
  const workflows = Array.isArray(catalog.data?.workflows) ? catalog.data.workflows : [];
  const apps = Array.isArray(catalog.data?.apps) ? catalog.data.apps : [];
  const firstWorkflow = workflows[0] || null;
  let appInfo = null;
  let hydrationSkippedReason = "";

  if (firstWorkflow) {
    assert(typeof firstWorkflow.catalogId === "string" && firstWorkflow.catalogId.length > 0, "catalogId missing");
    assert(typeof firstWorkflow.runTargetId === "string" && firstWorkflow.runTargetId.length > 0, "runTargetId missing");
    assert(typeof firstWorkflow.execution?.submit?.targetType === "string", "execution targetType missing");
    assert(typeof firstWorkflow.execution?.submit?.submitMode === "string", "execution submitMode missing");
    assert(Array.isArray(firstWorkflow.fields), "workflow fields missing");
    try {
      appInfo = await fetchJson(`/api/proxy/runninghub/app-info?webappId=${encodeURIComponent(firstWorkflow.runTargetId)}`);
      const remoteNodeInfoList = Array.isArray(appInfo.data?.nodeInfoList) ? appInfo.data.nodeInfoList : [];
      if ((Array.isArray(firstWorkflow.fields) ? firstWorkflow.fields.length : 0) === 0) {
        assert(remoteNodeInfoList.length > 0, "app-info should hydrate remote nodeInfoList when local fields are empty");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/RunningHub Provider 未配置 API Key/.test(message)) {
        hydrationSkippedReason = "local-runninghub-provider-missing-api-key";
      } else {
        throw error;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        workflowCount: workflows.length,
        appCount: apps.length,
        firstWorkflow: firstWorkflow
          ? {
            catalogId: firstWorkflow.catalogId,
            title: firstWorkflow.title,
            runTargetId: firstWorkflow.runTargetId,
            fieldCount: Array.isArray(firstWorkflow.fields) ? firstWorkflow.fields.length : 0,
            hydratedNodeInfoCount: Array.isArray(appInfo?.data?.nodeInfoList) ? appInfo.data.nodeInfoList.length : 0,
            hydrationSkippedReason: hydrationSkippedReason || undefined,
          }
        : null,
      },
      null,
      2,
    ),
  );
}

async function verifySourceContracts() {
  const [serverSource, workspaceSource, editorSource, nodeSource, queueSource] = await Promise.all([
    readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/src/admin-readonly-panels.tsx", import.meta.url), "utf8"),
  ]);
  assertIncludes(serverSource, "/api/admin/runninghub/items");
  assertIncludes(serverSource, "request.method === \"POST\"");
  assertIncludes(serverSource, "request.method === \"DELETE\"");
  assertIncludes(serverSource, "/api/admin/runninghub/analyze");
  assertIncludes(serverSource, "runninghub.item.create");
  assertIncludes(serverSource, "runninghub.item.delete");
  assertIncludes(serverSource, "runninghub.item.analyze");
  assertIncludes(workspaceSource, "新建工作流");
  assertIncludes(workspaceSource, "新建 AI 应用");
  assertIncludes(workspaceSource, "AI 分析并填写");
  assertIncludes(workspaceSource, "全部");
  assertIncludes(workspaceSource, "启用");
  assertIncludes(workspaceSource, "停用");
  assertIncludes(workspaceSource, "admin-runninghub-workspace__toolbar");
  assertIncludes(workspaceSource, "admin-runninghub-workspace__sticky-shell");
  assertIncludes(workspaceSource, "admin-runninghub-workspace__filters");
  assertIncludes(workspaceSource, "admin-runninghub-workspace__rail-footer");
  assertIncludes(workspaceSource, "admin-runninghub-list-item__icon");
  assertIncludes(editorSource, "另存为");
  assertIncludes(editorSource, "删除");
  assertIncludes(editorSource, "输入槽定义");
  assertIncludes(editorSource, "参数 Schema");
  assertIncludes(editorSource, "输出定义");
  assertIncludes(editorSource, "执行规则");
  assertIncludes(editorSource, "测试与调试");
  assertIncludes(editorSource, "admin-runninghub-editor__shell");
  assertIncludes(editorSource, "admin-runninghub-editor__body");
  assertIncludes(editorSource, "admin-runninghub-editor__side-panel");
  assertIncludes(workspaceSource, "admin-runninghub-analyze-panel__workbench");
  assertIncludes(nodeSource, "后台条目");
  assertIncludes(nodeSource, "通用输入");
  assertIncludes(nodeSource, "高级方式");
  assertIncludes(nodeSource, "进行中");
  assertIncludes(nodeSource, "成功");
  assertIncludes(nodeSource, "失败");
  assertIncludes(nodeSource, "targetType:");
  assertIncludes(nodeSource, "runTargetId: resolvedRunTargetId");
  assertIncludes(nodeSource, "taskCapability:");
  assertIncludes(nodeSource, "pageId:");
  assertIncludes(nodeSource, "workflowId:");
  assertIncludes(nodeSource, "autoHydratedCatalogRef");
  assertIncludes(nodeSource, "presetFieldCount");
  assertNotIncludes(nodeSource, "Webapp ID");
  assertIncludes(queueSource, "普通任务先受“类别总并发”限制");
  assertIncludes(queueSource, "RunningHub 平台并发治理");
  assertIncludes(queueSource, "RH 平台总并发");
  assertIncludes(queueSource, "启用 RH 平台并发治理");
}

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
}

function withCookie(options = {}) {
  return {
    ...options,
    headers: {
      ...sameOriginHeaders,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  };
}

function captureCookie(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return;
  cookie = raw.split(";")[0];
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertIncludes(source, needle) {
  assert(source.includes(needle), `missing source contract: ${needle}`);
}

function assertNotIncludes(source, needle) {
  assert(!source.includes(needle), `unexpected source contract: ${needle}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
