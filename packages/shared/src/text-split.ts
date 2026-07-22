export type TextSplitMode =
  | "paragraph"
  | "line"
  | "custom"
  | "storyboard"
  | "regex"
  | "markdown-heading"
  | "numbered"
  | "char-chunk";

export type TextSplitRegexStrategy = "split" | "match";

export interface TextSplitOptions {
  mode?: TextSplitMode;
  delimiter?: string;
  chunkSize?: number;
  regexPattern?: string;
  regexFlags?: string;
  regexStrategy?: TextSplitRegexStrategy;
  removeEmpty?: boolean;
  trim?: boolean;
  normalizeSpaces?: boolean;
  stripNumbering?: boolean;
  prefix?: string;
  suffix?: string;
}

export const TEXT_SPLIT_MODE_LABEL: Record<TextSplitMode, string> = {
  paragraph: "按段落",
  line: "按行",
  custom: "自定义分隔",
  storyboard: "智能分镜",
  regex: "正则高级",
  "markdown-heading": "按 Markdown 标题",
  numbered: "按序号/镜头",
  "char-chunk": "按字数切块",
};

const CJK_NUMERAL = "一二三四五六七八九十百千万零〇两";
const STORYBOARD_LABEL = "(?:镜头|分镜|场景|Scene\\b|Shot\\b)";
const STORYBOARD_TITLE_RE = new RegExp([
  "^\\s*(?:",
  "#{1,6}\\s+",
  "|[【\\[（(]?\\s*",
  `(?:${STORYBOARD_LABEL}\\s*(?:第\\s*)?(?:\\d{1,4}|[${CJK_NUMERAL}]+)?|第\\s*(?:\\d{1,4}|[${CJK_NUMERAL}]+)\\s*[镜幕场段章节])`,
  "\\s*[】\\]）)]?\\s*(?:[:：、.\\-—]\\s*)?",
  `|(?:\\d{1,4}|[${CJK_NUMERAL}]+)\\s*[.、)）:：\\-—]\\s+`,
  ")",
].join(""), "i");
const NUMBERING_RE = new RegExp([
  "^\\s*(?:",
  "\\d+[\\.\\)、)]|[（(]\\d+[）)]",
  `|第[${CJK_NUMERAL}0-9]+[镜幕场段章节条]?[:：、.]?`,
  `|${STORYBOARD_LABEL}\\s*(?:第\\s*)?[${CJK_NUMERAL}0-9]*[:：、.]?`,
  ")\\s*",
].join(""), "i");
const PARAGRAPH_SEPARATOR_RE = /\n[ \t\f\v\u00a0\u1680\u2000-\u200f\u202f\u205f\u3000\ufeff]*\n+/;

export function sanitizeTextSplitRegexFlags(flags = "gm"): string {
  const allowed = new Set(["d", "g", "i", "m", "s", "u", "v", "y"]);
  const result: string[] = [];
  for (const flag of String(flags || "")) {
    if (allowed.has(flag) && !result.includes(flag)) result.push(flag);
  }
  return result.join("") || "gm";
}

export function splitText(input: string, options: TextSplitOptions = {}): string[] {
  const mode = options.mode || "line";
  const text = normalizeInput(input);
  let parts: string[];
  if (mode === "line") parts = text.split("\n");
  else if (mode === "custom") parts = options.delimiter ? text.split(options.delimiter) : splitByBlankParagraph(text);
  else if (mode === "storyboard") parts = splitByStoryboard(text);
  else if (mode === "regex") parts = splitByRegex(text, options);
  else if (mode === "markdown-heading") parts = splitByMarkdownHeading(text);
  else if (mode === "numbered") parts = splitByNumbering(text);
  else if (mode === "char-chunk") parts = splitByChunk(text, options.chunkSize || 600);
  else parts = splitByBlankParagraph(text);

  const cleanup = {
    trim: options.trim !== false,
    normalizeSpaces: Boolean(options.normalizeSpaces),
    stripNumbering: Boolean(options.stripNumbering),
  };
  let cleaned = parts.map((part) => applyCleanup(part, cleanup));
  if (options.removeEmpty !== false) cleaned = cleaned.filter((part) => part.length > 0);
  return applyAffixes(cleaned, options.prefix, options.suffix);
}

function normalizeInput(input: string) {
  return String(input || "").replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, "\n");
}

function splitByBlankParagraph(text: string) {
  return text.split(PARAGRAPH_SEPARATOR_RE);
}

function applyCleanup(raw: string, options: { trim: boolean; normalizeSpaces: boolean; stripNumbering: boolean }) {
  let text = raw;
  if (options.stripNumbering) text = text.replace(NUMBERING_RE, "");
  if (options.normalizeSpaces) {
    text = text.split("\n").map((line) => line.replace(/[ \t]+/g, " ")).join("\n").replace(/\n{3,}/g, "\n\n");
  }
  return options.trim ? text.trim() : text;
}

function applyAffixes(parts: string[], prefix = "", suffix = "") {
  if (!prefix && !suffix) return parts;
  return parts.map((part, index) => `${fillTemplate(prefix, index + 1, parts.length)}${part}${fillTemplate(suffix, index + 1, parts.length)}`);
}

function fillTemplate(template: string, index: number, total: number) {
  return String(template || "")
    .replace(/\{\{\s*index\s*\}\}/g, String(index))
    .replace(/\{\{\s*total\s*\}\}/g, String(total));
}

function splitByMarkdownHeading(text: string) {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of text.split("\n")) {
    if (/^#{1,6}\s+\S/.test(line) && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks.length > 1 ? blocks : splitByBlankParagraph(text);
}

function splitByNumbering(text: string) {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const startsBlock = STORYBOARD_TITLE_RE.test(line) || NUMBERING_RE.test(line) || /^\s*[-*]\s+\S/.test(line);
    if (startsBlock && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  if (blocks.length > 1) return blocks;
  const hasNumbering = lines.some((line) => STORYBOARD_TITLE_RE.test(line) || NUMBERING_RE.test(line) || /^\s*[-*]\s+\S/.test(line));
  return hasNumbering ? blocks : splitByBlankParagraph(text);
}

function splitByStoryboard(text: string) {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const startsBlock = STORYBOARD_TITLE_RE.test(line)
      || /^[-*]\s*(?:镜头|分镜|场景|Scene|Shot)\b/i.test(trimmed)
      || /^(?:内景|外景|日景|夜景|清晨|黄昏)\s*[/-]\s*\S/.test(trimmed);
    if (startsBlock && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  if (blocks.length > 1) return blocks;
  const numbered = splitByNumbering(text);
  return numbered.length > 1 ? numbered : blocks.length > 0 ? blocks : splitByMarkdownHeading(text);
}

function splitByChunk(text: string, chunkSize: number) {
  const max = Math.max(1, Math.min(5000, Math.floor(chunkSize || 600)));
  const parts: string[] = [];
  let rest = text.trim();
  const softBreak = /[\n。！？!?；;，,]\s*$/;
  while (rest.length > max) {
    const search = rest.slice(0, max + 1);
    let cut = -1;
    for (let index = search.length - 1; index >= Math.floor(max * 0.55); index -= 1) {
      if (softBreak.test(search.slice(0, index + 1))) {
        cut = index + 1;
        break;
      }
    }
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

function splitByRegex(text: string, options: TextSplitOptions) {
  const pattern = String(options.regexPattern || "").trim();
  if (!pattern) return splitByBlankParagraph(text);
  const strategy = options.regexStrategy === "match" ? "match" : "split";
  const flags = sanitizeTextSplitRegexFlags(options.regexFlags || "gm");
  try {
    if (strategy === "match") {
      const matches: string[] = [];
      const regex = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
      for (const match of text.matchAll(regex)) matches.push(match.slice(1).find((item) => item != null && String(item).length > 0) || match[0]);
      return matches.length > 0 ? matches : splitByBlankParagraph(text);
    }
    return text.split(new RegExp(pattern, flags));
  } catch {
    return splitByBlankParagraph(text);
  }
}
