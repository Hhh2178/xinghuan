export type AssistantMessageBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; language: string; code: string }
  | { type: "quote"; text: string }
  | { type: "kv"; label: string; value: string };

export function parseAssistantMessageBlocks(input: string): AssistantMessageBlock[] {
  const text = normalizeAssistantMessageText(String(input || ""));
  if (!text) return [];

  const blocks: AssistantMessageBlock[] = [];
  const fencePattern = /```([\w-]+)?\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null = null;
  while ((match = fencePattern.exec(text))) {
    const plain = text.slice(cursor, match.index).trim();
    if (plain) blocks.push(...parsePlainBlocks(plain));
    blocks.push({
      type: "code",
      language: String(match[1] || "").trim().toLowerCase(),
      code: String(match[2] || "").trim(),
    });
    cursor = match.index + match[0].length;
  }
  const tail = text.slice(cursor).trim();
  if (tail) blocks.push(...parsePlainBlocks(tail));
  return blocks;
}

function parsePlainBlocks(text: string): AssistantMessageBlock[] {
  const blocks: AssistantMessageBlock[] = [];
  for (const segment of splitParagraphSegments(text)) {
    const lines = segment.split("\n").map((item) => item.trimEnd()).filter((item) => item.trim().length > 0);
    if (lines.length === 0) continue;

    if (/^#{1,4}\s+/.test(lines[0])) {
      blocks.push({
        type: "heading",
        text: cleanInlineMarkdown(lines[0].replace(/^#{1,4}\s+/, "").trim()),
      });
      const rest = lines.slice(1);
      if (rest.length > 0) blocks.push(...parsePlainBlocks(rest.join("\n")));
      continue;
    }

    if (/^\d+\.\s+/.test(lines[0]) && lines.length > 1) {
      blocks.push({
        type: "heading",
        text: cleanInlineMarkdown(lines[0].replace(/^\d+\.\s+/, "").trim()),
      });
      const rest = lines.slice(1);
      if (rest.length > 0) blocks.push(...parsePlainBlocks(rest.join("\n")));
      continue;
    }

    if (lines.every((line) => /^>\s?/.test(line))) {
      blocks.push({
        type: "quote",
        text: lines.map((line) => line.replace(/^>\s?/, "")).join("\n").trim(),
      });
      continue;
    }

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({
        type: "list",
        ordered: false,
        items: lines.map((line) => cleanInlineMarkdown(line.replace(/^[-*]\s+/, "").trim())).filter(Boolean),
      });
      continue;
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      blocks.push({
        type: "list",
        ordered: true,
        items: lines.map((line) => cleanInlineMarkdown(line.replace(/^\d+\.\s+/, "").trim())).filter(Boolean),
      });
      continue;
    }

    if (lines.length === 1) {
      const kv = parseKeyValueLine(lines[0]);
      if (kv) {
        blocks.push(kv);
        continue;
      }
    }

    blocks.push({
      type: "paragraph",
      text: cleanInlineMarkdown(lines.join("\n").trim()),
    });
  }
  return blocks;
}

function normalizeAssistantMessageText(input: string) {
  let text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  text = text.replace(/##\s*([^#\n]+?)\s*##/g, "\n\n## $1\n");
  text = text.replace(/-{4,}/g, "\n\n");
  text = text.replace(/([^\n])(\d+\.\s+)/g, "$1\n$2");
  text = text.replace(/([^\n])(##\s+)/g, "$1\n\n$2");
  text = text.replace(/\|\|/g, "|");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function cleanInlineMarkdown(input: string) {
  return String(input || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function splitParagraphSegments(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValueLine(line: string): AssistantMessageBlock | null {
  const normalized = String(line || "").trim();
  if (!normalized) return null;
  const match = normalized.match(/^([^\n:：]{1,40})\s*[:：]\s+([\s\S]+)$/);
  if (!match) return null;
  const label = cleanInlineMarkdown(match[1]);
  const value = cleanInlineMarkdown(match[2]);
  if (!label || !value) return null;
  return {
    type: "kv",
    label,
    value,
  };
}
