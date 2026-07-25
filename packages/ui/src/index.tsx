import { Activity, Box, Database, KeyRound, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export * from "./assistant-markdown.js";
export * from "./channel-health-report.js";
export * from "./ime-safe-text-control.js";

export const themeTokens = {
  background: "#07100f",
  surface: "#0d1a1c",
  panel: "#102326",
  border: "#1c3b3f",
  accent: "#31f0b3",
  accentSoft: "#123d35",
  text: "#e7fff7",
  muted: "#88a7a3",
  danger: "#ff5c7a",
};

export interface ShellProps {
  title: string;
  subtitle: string;
  mode: "canvas" | "admin";
  children: ReactNode;
}

export function XinghuanShell({ title, subtitle, mode, children }: ShellProps) {
  return (
    <main className="xh-shell">
      <aside className="xh-rail" aria-label="主导航">
        <Sparkles aria-hidden="true" />
        <button type="button" aria-label="工作台">
          <Box aria-hidden="true" />
        </button>
        <button type="button" aria-label="任务状态">
          <Activity aria-hidden="true" />
        </button>
        <button type="button" aria-label="素材库">
          <Database aria-hidden="true" />
        </button>
        <button type="button" aria-label="权限与密钥">
          <KeyRound aria-hidden="true" />
        </button>
      </aside>
      <section className="xh-stage">
        <header className="xh-header">
          <div>
            <p>{mode === "admin" ? "统一后台" : "无限画布"}</p>
            <h1>{title}</h1>
          </div>
          <span>{subtitle}</span>
        </header>
        {children}
      </section>
    </main>
  );
}
