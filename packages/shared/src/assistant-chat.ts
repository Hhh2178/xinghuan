import type { AssistantMessageBlock } from "./assistant-message-blocks.js";
import type { AssistantContent } from "./assistant-content.js";

export interface AssistantChatResult {
  mode: "agent" | "fallback";
  message: string;
  rawAssistant: string;
  content: AssistantContent;
  blocks?: AssistantMessageBlock[];
}
