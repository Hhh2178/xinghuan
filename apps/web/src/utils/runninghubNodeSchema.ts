import type { RhInputSlotDefinition } from "@xinghuan/shared";
import type { RunningHubCatalogItem } from "../services/runninghubCatalog";

export interface RunningHubNodeSchema {
  title: string;
  kind: "app" | "workflow";
  inputSlots: RhInputSlotDefinition[];
  outputs: Array<{
    key: string;
    dataType: "image" | "video" | "audio" | "text" | "json";
    cardinality: "single" | "multiple";
    path: string;
  }>;
}

function inferOutputs(item: RunningHubCatalogItem): RunningHubNodeSchema["outputs"] {
  const lower = String(item.workflowJson || "").toLowerCase();
  if (lower.includes("video")) {
    return [{ key: "video", dataType: "video", cardinality: "multiple", path: "data" }];
  }
  if (lower.includes("audio")) {
    return [{ key: "audio", dataType: "audio", cardinality: "multiple", path: "data" }];
  }
  if (lower.includes("text")) {
    return [{ key: "text", dataType: "text", cardinality: "single", path: "data" }];
  }
  return [{ key: "image", dataType: "image", cardinality: "multiple", path: "data" }];
}

export function buildRunningHubNodeSchema(item: RunningHubCatalogItem): RunningHubNodeSchema {
  return {
    title: item.title,
    kind: item.kind,
    inputSlots: Array.isArray(item.inputSlots) ? item.inputSlots : [],
    outputs: inferOutputs(item),
  };
}
