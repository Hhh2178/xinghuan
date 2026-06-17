export type AssistantMessageBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string };

export function parseAssistantMessageBlocks(input: string): AssistantMessageBlock[] {
  const text = String(input || "").replace(/\r\n/g, "\n").trim();
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
  for (const segment of text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)) {
    const lines = segment.split("\n").map((item) => item.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({
        type: "list",
        items: lines.map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean),
      });
      continue;
    }
    if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) {
      blocks.push({
        type: "heading",
        text: lines[0].replace(/^#{1,4}\s+/, "").trim(),
      });
      continue;
    }
    blocks.push({
      type: "paragraph",
      text: lines.join("\n"),
    });
  }
  return blocks;
}
