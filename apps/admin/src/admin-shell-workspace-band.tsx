import { AdminBandTabButton, AdminWorkspaceBand } from "./admin-common-components";
import {
  descriptionForWorkspaceTab,
  type AdminTabId,
  type AdminWorkspace,
} from "./admin-view-model";

export interface AdminShellSubpage {
  id: string;
  label: string;
  description: string;
}

export function AdminShellWorkspaceBand({
  workspace,
  workspaceTabs,
  activeTab,
  currentLabel,
  currentDescription,
  refreshLabel,
  refreshIntervalLabel,
  subpages = [],
  activeSubpage,
  onNavigateTab,
  onNavigateSubpage,
}: {
  workspace: AdminWorkspace;
  workspaceTabs: Array<{ id: AdminTabId; label: string; icon: AdminWorkspace["icon"] }>;
  activeTab: AdminTabId;
  currentLabel: string;
  currentDescription: string;
  refreshLabel: string;
  refreshIntervalLabel: string;
  subpages?: AdminShellSubpage[];
  activeSubpage?: string;
  onNavigateTab: (tabId: AdminTabId) => void;
  onNavigateSubpage?: (subpageId: string) => void;
}) {
  const showNavigation = subpages.length > 1 || (!subpages.length && workspaceTabs.length > 1);

  return (
    <AdminWorkspaceBand
      kicker={workspace.subtitle}
      title={workspace.label}
      description={workspace.description}
      currentLabel={currentLabel}
      currentDescription={currentDescription}
      actions={
        <div className="admin-workspace-band__meta-pills" aria-label="当前工作区状态">
          <span>{refreshLabel}</span>
          <span>{refreshIntervalLabel}</span>
        </div>
      }
      footer={showNavigation ? (
        <div className="admin-workspace-band__tab-row" role="tablist" aria-label={`${workspace.label}页面`}>
          {subpages.length ? subpages.map((item) => {
            const Icon = workspace.icon;
            return (
              <AdminBandTabButton
                key={item.id}
                active={activeSubpage === item.id}
                onClick={() => onNavigateSubpage?.(item.id)}
                aria-pressed={activeSubpage === item.id}
              >
                <Icon aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </AdminBandTabButton>
            );
          }) : workspaceTabs.map((item) => {
            const Icon = item.icon;
            return (
              <AdminBandTabButton
                key={item.id}
                active={activeTab === item.id}
                onClick={() => onNavigateTab(item.id)}
                aria-pressed={activeTab === item.id}
              >
                <Icon aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{descriptionForWorkspaceTab(workspace.id, item.id)}</small></span>
              </AdminBandTabButton>
            );
          })}
        </div>
      ) : undefined}
    />
  );
}
