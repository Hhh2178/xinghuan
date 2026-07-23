import { Check, Copy } from "lucide-react";
import { useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface AssistantMarkdownProps {
  markdown: string;
  className?: string;
  copyableBlocks?: boolean;
}

function safeUrl(url: string) {
  const value = String(url || "").trim();
  if (/^(?:https?:|mailto:)/i.test(value)) return value;
  if (/^(?:[/.#?]|$)/.test(value)) return value;
  return "";
}

function SafeLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  const safeHref = safeUrl(href || "");
  const external = /^https?:\/\//i.test(safeHref);
  return (
    <a
      {...props}
      href={safeHref || undefined}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

function CopyableBlock({ kind, children }: { kind: "code" | "table" | "steps" | "note"; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const copy = async () => {
    const content = contentRef.current;
    if (!content) return;
    const text = kind === "table"
      ? [...content.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.textContent?.trim() || "").join("\t")).join("\n")
      : content.innerText.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };
  return (
    <div className="xh-assistant-result-block" data-kind={kind}>
      <button type="button" className="xh-assistant-result-block__copy" onClick={() => void copy()} title={copied ? "已复制" : "复制此块"} aria-label={copied ? "已复制" : "复制此块"}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <div ref={contentRef} className="xh-assistant-result-block__content">{children}</div>
    </div>
  );
}

export function AssistantMarkdown({ markdown, className, copyableBlocks = false }: AssistantMarkdownProps) {
  return (
    <div className={["xh-assistant-markdown", className].filter(Boolean).join(" ")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeUrl}
        components={{
          a: SafeLink,
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          h4: ({ children }) => <h5>{children}</h5>,
          h5: ({ children }) => <h5>{children}</h5>,
          h6: ({ children }) => <h5>{children}</h5>,
          img: ({ alt }) => <span role="note">{alt || "Image omitted"}</span>,
          pre: ({ children }) => copyableBlocks ? <CopyableBlock kind="code"><pre>{children}</pre></CopyableBlock> : <pre>{children}</pre>,
          table: ({ children }) => copyableBlocks ? <CopyableBlock kind="table"><table>{children}</table></CopyableBlock> : <table>{children}</table>,
          ol: ({ children }) => copyableBlocks ? <CopyableBlock kind="steps"><ol>{children}</ol></CopyableBlock> : <ol>{children}</ol>,
          blockquote: ({ children }) => copyableBlocks ? <CopyableBlock kind="note"><blockquote>{children}</blockquote></CopyableBlock> : <blockquote>{children}</blockquote>,
        }}
      >
        {String(markdown || "")}
      </ReactMarkdown>
    </div>
  );
}
