import { useMemo, useState } from "react";
import { capabilityLabel } from "./admin-view-model";
import type { Capability, FetchModelsResult, ModelCapabilityTag, ModelRecord } from "./admin-types";

export function ModelPicker({
  fetched,
  existing,
  providerId,
  onClose,
  onImport,
}: {
  fetched: FetchModelsResult;
  existing: ModelRecord[];
  providerId: string;
  onClose: () => void;
  onImport: (
    items: Array<{
      modelId: string;
      capability: Capability;
      displayName: string;
      capabilityTags?: ModelCapabilityTag[];
    }>,
  ) => Promise<void>;
}) {
  const existingMap = useMemo(
    () => new Map(existing.map((m) => [m.modelId, m.capability])),
    [existing],
  );
  const initial = useMemo(() => {
    const ids = new Set(fetched.all || []);
    const category: Record<string, Capability> = {};
    const selected: Record<string, boolean> = {};
    for (const id of ids) {
      const existingCapability = existingMap.get(id);
      const capability = existingCapability
        ? existingCapability
        : (fetched.imageModels || []).includes(id)
          ? "image"
          : (fetched.videoModels || []).includes(id)
            ? "video"
            : (fetched.audioModels || []).includes(id)
              ? "audio"
              : "chat";
      category[id] = capability;
      selected[id] = Boolean(existingCapability);
    }
    return { category, selected };
  }, [existing, existingMap, fetched]);
  const [category, setCategory] = useState(initial.category);
  const [selected, setSelected] = useState(initial.selected);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<Capability | "all">("all");
  const ids = Object.keys(category).sort();
  const visible = ids.filter(
    (id) =>
      (!filter || id.toLowerCase().includes(filter.toLowerCase())) &&
      (tab === "all" || category[id] === tab),
  );
  const selectedCount = ids.filter((id) => selected[id]).length;

  const importItems = ids
    .filter((id) => selected[id])
    .map((id) => ({
      modelId: id,
      displayName: id,
      capability: category[id] || "chat",
      capabilityTags: fetched.modelTags?.[id] || [],
    }));

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true">
      <section className="model-picker">
        <header>
          <div>
            <h3>选择模型</h3>
            <p>
              {providerId} · 共 {ids.length} 个模型 · 已选 {selectedCount} 个
            </p>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="picker-toolbar">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="搜索模型"
          />
          {(
            ["all", "image", "chat", "video", "audio"] as Array<Capability | "all">
          ).map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {item === "all" ? "全部" : capabilityLabel(item)}{" "}
              {
                ids.filter(
                  (id) => item === "all" || category[id] === item,
                ).length
              }
            </button>
          ))}
        </div>
        <div className="picker-list">
          {visible.map((id) => (
            <div
              className={selected[id] ? "picker-row selected" : "picker-row"}
              key={id}
            >
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(selected[id])}
                  onChange={(event) =>
                    setSelected({ ...selected, [id]: event.target.checked })
                  }
                />
                <span>{id}</span>
              </label>
              <select
                value={category[id]}
                onChange={(event) =>
                  setCategory({
                    ...category,
                    [id]: event.target.value as Capability,
                  })
                }
              >
                <option value="image">图像</option>
                <option value="chat">语言</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
              </select>
            </div>
          ))}
        </div>
        <footer>
          <span>
            生图 {importItems.filter((i) => i.capability === "image").length}
          </span>
          <span>
            LLM {importItems.filter((i) => i.capability === "chat").length}
          </span>
          <span>
            视频 {importItems.filter((i) => i.capability === "video").length}
          </span>
          <span>
            音频 {importItems.filter((i) => i.capability === "audio").length}
          </span>
          <button
            type="button"
            className="primary-action"
            onClick={() => onImport(importItems)}
          >
            导入选中模型
          </button>
        </footer>
      </section>
    </div>
  );
}
