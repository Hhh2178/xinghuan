export const ASSISTANT_CONTENT_FORMAT = "markdown-v1" as const;

export interface AssistantContent {
  format: typeof ASSISTANT_CONTENT_FORMAT;
  version: 1;
  text: string;
}

const openingReasoningTags = ["<think>", "<analysis>", "<reasoning>"] as const;
const closingReasoningTags = ["</think>", "</analysis>", "</reasoning>"] as const;
const reasoningTags = [...openingReasoningTags, ...closingReasoningTags];
const internalLinePrefixes = ["analysis:", "reasoning:", "context:"] as const;

export interface AssistantContentStreamFilter {
  push(chunk: string): string;
  finish(): string;
}

export function createAssistantContentStreamFilter(): AssistantContentStreamFilter {
  let reasoningDepth = 0;
  let tagBuffer = "";
  let linePrefixBuffer = "";
  let atLineStart = true;
  let droppingInternalLine = false;

  const filterInternalLines = (input: string) => {
    let output = "";
    for (const character of input) {
      if (droppingInternalLine) {
        if (character === "\n") {
          droppingInternalLine = false;
          atLineStart = true;
        }
        continue;
      }

      if (!atLineStart) {
        output += character;
        if (character === "\n") atLineStart = true;
        continue;
      }

      linePrefixBuffer += character;
      if (character === "\n") {
        output += linePrefixBuffer;
        linePrefixBuffer = "";
        atLineStart = true;
        continue;
      }

      const candidate = linePrefixBuffer.trimStart().toLowerCase();
      if (internalLinePrefixes.includes(candidate as (typeof internalLinePrefixes)[number])) {
        linePrefixBuffer = "";
        droppingInternalLine = true;
        atLineStart = false;
        continue;
      }
      if (candidate === "" || internalLinePrefixes.some((prefix) => prefix.startsWith(candidate))) {
        continue;
      }

      output += linePrefixBuffer;
      linePrefixBuffer = "";
      atLineStart = false;
    }
    return output;
  };

  const push = (chunk: string) => {
    let visible = "";
    for (const character of String(chunk || "")) {
      if (tagBuffer || character === "<") {
        tagBuffer += character;
        const candidate = tagBuffer.toLowerCase();
        const openingIndex = openingReasoningTags.indexOf(candidate as (typeof openingReasoningTags)[number]);
        const closingIndex = closingReasoningTags.indexOf(candidate as (typeof closingReasoningTags)[number]);
        if (openingIndex >= 0) {
          reasoningDepth += 1;
          tagBuffer = "";
          continue;
        }
        if (closingIndex >= 0) {
          reasoningDepth = Math.max(0, reasoningDepth - 1);
          tagBuffer = "";
          continue;
        }
        if (reasoningTags.some((tag) => tag.startsWith(candidate))) continue;

        if (reasoningDepth === 0) visible += tagBuffer;
        tagBuffer = "";
        continue;
      }

      if (reasoningDepth === 0) visible += character;
    }
    return filterInternalLines(visible);
  };

  const finish = () => {
    let output = "";
    if (reasoningDepth === 0 && tagBuffer) output += filterInternalLines(tagBuffer);
    tagBuffer = "";
    if (!droppingInternalLine && linePrefixBuffer) output += linePrefixBuffer;
    linePrefixBuffer = "";
    return output;
  };

  return { push, finish };
}

export function normalizeAssistantContent(input: string) {
  const filter = createAssistantContentStreamFilter();
  return `${filter.push(String(input || ""))}${filter.finish()}`
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createAssistantContent(input: string): AssistantContent {
  return {
    format: ASSISTANT_CONTENT_FORMAT,
    version: 1,
    text: normalizeAssistantContent(input),
  };
}
