import type { AssistantMessageBlock } from "./assistant-message-blocks.js";

export interface AssistantChatResult {
  mode: "hermes" | "fallback";
  message: string;
  rawAssistant: string;
  blocks?: AssistantMessageBlock[];
}
