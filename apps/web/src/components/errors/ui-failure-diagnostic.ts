export type UiFailureScope =
  | "app-shell"
  | "workspace"
  | "node-renderer"
  | "lazy-chunk"
  | "media-preview"
  | "admin-route";

export interface UiFailureDiagnostic {
  id: string;
  scope: UiFailureScope;
  code: string;
  occurredAt: string;
  recoverable: boolean;
  userMessage: string;
}

const descriptions: Record<UiFailureScope, { code: string; recoverable: boolean; userMessage: string }> = {
  "app-shell": {
    code: "UI_APP_SHELL_ERROR",
    recoverable: false,
    userMessage: "应用界面暂时无法继续加载，请刷新页面后重试。",
  },
  workspace: {
    code: "UI_WORKSPACE_ERROR",
    recoverable: true,
    userMessage: "画布工作区暂时无法显示，重试不会修改当前画布内容。",
  },
  "node-renderer": {
    code: "UI_NODE_RENDERER_ERROR",
    recoverable: true,
    userMessage: "此节点暂时无法显示，重试不会修改节点或画布内容。",
  },
  "lazy-chunk": {
    code: "UI_LAZY_CHUNK_ERROR",
    recoverable: true,
    userMessage: "页面功能暂时未能加载，请重试；若仍失败可刷新页面。",
  },
  "media-preview": {
    code: "UI_MEDIA_PREVIEW_ERROR",
    recoverable: true,
    userMessage: "素材预览暂时无法显示，素材和画布内容没有被修改。",
  },
  "admin-route": {
    code: "UI_ADMIN_ROUTE_ERROR",
    recoverable: true,
    userMessage: "当前后台页面暂时无法显示，其他后台页面仍可继续使用。",
  },
};

export function toUiFailureDiagnostic(_error: unknown, scope: UiFailureScope): UiFailureDiagnostic {
  const description = descriptions[scope];
  return {
    id: `ui-${scope}-${diagnosticSuffix()}`,
    scope,
    code: description.code,
    occurredAt: new Date().toISOString(),
    recoverable: description.recoverable,
    userMessage: description.userMessage,
  };
}

function diagnosticSuffix() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
