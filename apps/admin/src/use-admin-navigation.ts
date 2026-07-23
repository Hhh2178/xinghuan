import { useEffect, useState } from "react";
import {
  adminWorkspaces,
  pathForRhView,
  pathForAnalyticsView,
  pathForSystemView,
  pathForCapabilitiesView,
  pathForAgentRuntimeView,
  pathForUsersView,
  pathForWorkspaceTab,
  resolveAdminPath,
  type AdminTabId,
  type AdminRhViewId,
  type AdminAnalyticsViewId,
  type AdminSystemViewId,
  type AdminCapabilitiesViewId,
  type AdminAgentRuntimeViewId,
  type AdminUsersViewId,
  type AdminWorkspaceId,
} from "./admin-view-model";

export function useAdminNavigation() {
  const initialRoute = typeof window === "undefined"
    ? resolveAdminPath("/admin/overview")
    : resolveAdminPath(window.location.pathname);
  const [activeTab, setActiveTab] = useState<AdminTabId>(initialRoute.tabId);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<AdminWorkspaceId>(initialRoute.workspaceId);
  const [activeUsersView, setActiveUsersView] = useState<AdminUsersViewId>(initialRoute.usersView || "overview");
  const [activeRhView, setActiveRhView] = useState<AdminRhViewId>(initialRoute.rhView || "workflows");
  const [activeAnalyticsView, setActiveAnalyticsView] = useState<AdminAnalyticsViewId>(initialRoute.analyticsView || "usage");
  const [activeSystemView, setActiveSystemView] = useState<AdminSystemViewId>(initialRoute.systemView || "health");
  const [activeComfyuiInstanceId, setActiveComfyuiInstanceId] = useState(initialRoute.comfyuiInstanceId || "");
  const [activeComfyuiDetailTab, setActiveComfyuiDetailTab] = useState<"config" | "workflows" | "logs">(initialRoute.comfyuiDetailTab || "config");
  const [activeCapabilitiesView, setActiveCapabilitiesView] = useState<AdminCapabilitiesViewId>(initialRoute.capabilitiesView || "providers");
  const [activeAgentRuntimeView, setActiveAgentRuntimeView] = useState<AdminAgentRuntimeViewId>(initialRoute.agentRuntimeView || "controls");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncRouteFromLocation = () => {
      const route = resolveAdminPath(window.location.pathname);
      setActiveWorkspaceId(route.workspaceId);
      setActiveTab(route.tabId);
      if (route.usersView) setActiveUsersView(route.usersView);
      if (route.rhView) setActiveRhView(route.rhView);
      if (route.analyticsView) setActiveAnalyticsView(route.analyticsView);
      if (route.systemView) setActiveSystemView(route.systemView);
      setActiveComfyuiInstanceId(route.comfyuiInstanceId || "");
      setActiveComfyuiDetailTab(route.comfyuiDetailTab || "config");
      if (route.capabilitiesView) setActiveCapabilitiesView(route.capabilitiesView);
      if (route.agentRuntimeView) setActiveAgentRuntimeView(route.agentRuntimeView);
    };
    window.addEventListener("popstate", syncRouteFromLocation);
    if (window.location.pathname === "/admin" || window.location.pathname === "/admin/") {
      window.history.replaceState({}, "", pathForWorkspaceTab("overview", "overview"));
    }
    return () => window.removeEventListener("popstate", syncRouteFromLocation);
  }, []);

  function navigateAdmin(workspaceId: AdminWorkspaceId, tabId?: AdminTabId) {
    const workspace = adminWorkspaces.find((item) => item.id === workspaceId) || adminWorkspaces[0];
    const nextTab = tabId && workspace.tabs.includes(tabId) ? tabId : workspace.tabs[0];
    const nextPath = pathForWorkspaceTab(workspace.id, nextTab);
    setActiveWorkspaceId(workspace.id);
    setActiveTab(nextTab);
    if (workspace.usersView) setActiveUsersView(workspace.usersView);
    if (workspace.id === "rh") setActiveRhView("workflows");
    if (workspace.id === "analytics") setActiveAnalyticsView("usage");
    if (workspace.id === "system") setActiveSystemView(nextTab === "environment-sync" ? "environment-sync" : "health");
    if (workspace.id === "comfyui") { setActiveComfyuiInstanceId(""); setActiveComfyuiDetailTab("config"); }
    if (workspace.id === "capabilities") setActiveCapabilitiesView(nextTab === "assistant" ? "admin-assistant" : "providers");
    if (workspace.id === "automation") setActiveAgentRuntimeView("controls");
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }

  function navigateRhView(viewId: AdminRhViewId) {
    const nextPath = pathForRhView(viewId);
    setActiveWorkspaceId("rh");
    setActiveTab("runninghub-workspace");
    setActiveRhView(viewId);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }

  function navigateAnalyticsView(viewId: AdminAnalyticsViewId) {
    const nextPath = pathForAnalyticsView(viewId);
    setActiveWorkspaceId("analytics"); setActiveTab("audit"); setActiveAnalyticsView(viewId);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }

  function navigateSystemView(viewId: AdminSystemViewId) {
    const nextPath = pathForSystemView(viewId);
    setActiveWorkspaceId("system");
    setActiveTab(viewId === "environment-sync" ? "environment-sync" : "system");
    setActiveSystemView(viewId);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }

  function navigateComfyuiInstance(instanceId?: string, detailTab: "config" | "workflows" | "logs" = "config") {
    const nextPath = instanceId ? `/admin/comfyui/instances/${encodeURIComponent(instanceId)}/${detailTab}` : "/admin/comfyui";
    setActiveWorkspaceId("comfyui"); setActiveTab("comfyui");
    setActiveComfyuiInstanceId(instanceId || ""); setActiveComfyuiDetailTab(detailTab);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }

  function navigateCapabilitiesView(viewId: AdminCapabilitiesViewId) {
    const nextPath = pathForCapabilitiesView(viewId);
    setActiveWorkspaceId("capabilities"); setActiveTab(viewId === "admin-assistant" ? "assistant" : "providers");
    setActiveCapabilitiesView(viewId);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }

  function navigateUsersView(viewId: AdminUsersViewId) {
    const workspaceId: AdminWorkspaceId = viewId === "permissions" ? "security" : "organization";
    const nextPath = pathForUsersView(viewId);
    setActiveWorkspaceId(workspaceId);
    setActiveTab("users");
    setActiveUsersView(viewId);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }

  function navigateAgentRuntimeView(viewId: AdminAgentRuntimeViewId) {
    const nextPath = pathForAgentRuntimeView(viewId);
    setActiveWorkspaceId("automation"); setActiveTab("agent-runtime"); setActiveAgentRuntimeView(viewId);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }

  return {
    activeTab,
    activeWorkspaceId,
    activeUsersView,
    activeRhView,
    activeAnalyticsView,
    activeSystemView,
    activeComfyuiInstanceId,
    activeComfyuiDetailTab,
    activeCapabilitiesView,
    activeAgentRuntimeView,
    navigateAdmin,
    navigateUsersView,
    navigateRhView,
    navigateAnalyticsView,
    navigateSystemView,
    navigateComfyuiInstance,
    navigateCapabilitiesView,
    navigateAgentRuntimeView,
  };
}
