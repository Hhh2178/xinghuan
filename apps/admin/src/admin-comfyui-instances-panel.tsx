import { AdminComfyuiOverview } from "./admin-comfyui-overview";
import { AdminComfyuiDetail, type DetailTab } from "./admin-comfyui-detail";

export function AdminComfyuiInstancesPanel({ instanceId = "", detailTab = "config", onNavigate }: {
  instanceId?: string;
  detailTab?: DetailTab;
  onNavigate?: (instanceId?: string, detailTab?: DetailTab) => void;
}) {
  if (instanceId) {
    return (
      <AdminComfyuiDetail
        instanceId={instanceId}
        activeTab={detailTab}
        onTabChange={(tab) => onNavigate?.(instanceId, tab)}
        onBack={() => onNavigate?.()}
      />
    );
  }

  return <AdminComfyuiOverview onSelectInstance={(id) => onNavigate?.(id, "config")} />;
}

export default AdminComfyuiInstancesPanel;
