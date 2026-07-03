import { useState } from "react";
import { AdminComfyuiOverview } from "./admin-comfyui-overview";
import { AdminComfyuiDetail } from "./admin-comfyui-detail";

export function AdminComfyuiInstancesPanel() {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  if (selectedInstanceId) {
    return (
      <AdminComfyuiDetail
        instanceId={selectedInstanceId}
        onBack={() => setSelectedInstanceId(null)}
      />
    );
  }

  return <AdminComfyuiOverview onSelectInstance={(id) => setSelectedInstanceId(id)} />;
}

export default AdminComfyuiInstancesPanel;
