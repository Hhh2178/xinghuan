import type { AssistantMessageBlock } from "./assistant-message-blocks.js";

export interface AssistantChatResult {
  mode: "agent" | "fallback";
  message: string;
  rawAssistant: string;
  blocks?: AssistantMessageBlock[];
}
