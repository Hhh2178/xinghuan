import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { capabilityLabel } from "./admin-view-model";
import type { Capability } from "./main";

export function ManualModelDialog({
  capability,
  providerName,
  busy,
  onCancel,
  onSubmit,
}: {
  capability: Capability;
  providerName: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (modelId: string) => Promise<void>;
}) {
  const [modelId, setModelId] = useState("");
  const trimmedModelId = modelId.trim();
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="manual-model-title">
      <form
        className="manual-model-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmedModelId) void onSubmit(trimmedModelId);
        }}
      >
        <header>
          <h3 id="manual-model-title">新增{capabilityLabel(capability)}模型</h3>
          <p>{providerName} · 手动登记模型 ID 后，画布会从模型目录读取。</p>
        </header>
        <label>
          模型 ID
          <input
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            placeholder={capability === "image" ? "gpt-image-2" : capability === "video" ? "grok-video" : "gpt-5.5"}
            autoFocus
          />
        </label>
        <p className="field-note">默认会按当前能力分类创建，并生成可继续编辑的参数 Schema。</p>
        <footer>
          <button type="button" className="ghost-action" onClick={onCancel} disabled={busy}>取消</button>
          <button type="submit" className="primary-action" disabled={busy || !trimmedModelId}>
            {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            创建模型
          </button>
        </footer>
      </form>
    </div>
  );
}
