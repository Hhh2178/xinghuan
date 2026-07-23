import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface AssistantMarkdownProps {
  markdown: string;
  className?: string;
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

export function AssistantMarkdown({ markdown, className }: AssistantMarkdownProps) {
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
        }}
      >
        {String(markdown || "")}
      </ReactMarkdown>
    </div>
  );
}
