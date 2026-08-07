export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}

export interface EffectivePermissions {
  groupId: string;
  isAdmin: boolean;
  nodePermissionResolution?: {
    status: "ready" | "degraded";
    failedNodeTypes: string[];
  };
  deny: {
    sharedResourceCategoryIds: string[];
    sharedResourceItemIds: string[];
    runningHubAppCatalogIds: string[];
    runningHubWorkflowCatalogIds: string[];
    nodeTypes: string[];
  };
}
