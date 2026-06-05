export type PortKind = "text" | "image" | "video" | "audio" | "config" | "any";

export interface CanvasNodeDefinition {
  id: string;
  title: string;
  category: "input" | "generate" | "asset" | "tool";
  inputs: PortKind[];
  outputs: PortKind[];
}

export const starterNodeDefinitions: CanvasNodeDefinition[] = [
  {
    id: "text-prompt",
    title: "文本提示词",
    category: "input",
    inputs: [],
    outputs: ["text"],
  },
  {
    id: "image-generate",
    title: "通用图像生成",
    category: "generate",
    inputs: ["text", "image"],
    outputs: ["image"],
  },
  {
    id: "asset-output",
    title: "素材输出",
    category: "asset",
    inputs: ["any"],
    outputs: [],
  },
];
