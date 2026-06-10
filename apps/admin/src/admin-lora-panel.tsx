import { Plus, Trash2 } from "lucide-react";
import type { ModelScopeLora } from "./admin-types";

function BlockTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="block-title">
      <strong>{title}</strong>
      <span>{sub}</span>
    </div>
  );
}

export function ModelScopeLoraPanel({
  loras,
  imageModels,
  onChange,
}: {
  loras: ModelScopeLora[];
  imageModels: string[];
  onChange: (loras: ModelScopeLora[]) => void;
}) {
  const modelOptions = imageModels.length
    ? imageModels
    : ["Tongyi-MAI/Z-Image-Turbo", "Qwen/Qwen-Image-2512"];
  function update(index: number, patch: Partial<ModelScopeLora>) {
    onChange(
      loras.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }
  return (
    <section className="api-card lora-panel">
      <div className="model-section-head">
        <BlockTitle
          title="ModelScope LoRA"
          sub="为当前外部模型绑定 LoRA，供图像节点按模型自动选择"
        />
        <button
          type="button"
          className="ghost-action"
          onClick={() =>
            onChange([
              {
                id: "",
                name: "",
                targetModel: modelOptions[0],
                strength: 0.8,
                enabled: true,
              },
              ...loras,
            ])
          }
        >
          <Plus aria-hidden="true" /> LoRA
        </button>
      </div>
      <div className="lora-list">
        {loras.length ? (
          loras.map((lora, index) => (
            <div className="lora-row" key={`${lora.id}-${index}`}>
              <input
                value={lora.id}
                onChange={(e) => update(index, { id: e.target.value })}
                placeholder="LoRA ID，例如 user/style"
              />
              <select
                value={lora.targetModel}
                onChange={(e) =>
                  update(index, { targetModel: e.target.value })
                }
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="2"
                step="0.05"
                value={lora.strength}
                onChange={(e) =>
                  update(index, { strength: Number(e.target.value) })
                }
              />
              <button
                type="button"
                className="icon-soft"
                onClick={() =>
                  update(index, { enabled: !lora.enabled })
                }
              >
                {lora.enabled ? "启用" : "停用"}
              </button>
              <button
                type="button"
                className="icon-soft"
                onClick={() =>
                  onChange(loras.filter((_, i) => i !== index))
                }
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))
        ) : (
          <div className="empty-models">暂无 LoRA</div>
        )}
      </div>
    </section>
  );
}

