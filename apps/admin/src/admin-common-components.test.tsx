import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Activity, Users } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminSummaryStrip, AdminWorkspaceBand, AdminWorkspaceFrame } from "./admin-common-components";

describe("Admin A shared visual foundation", () => {
  it("keeps the shell-owned page heading as the single workspace identity", () => {
    const markup = renderToStaticMarkup(
      <AdminWorkspaceFrame>
        <p>工作区内容</p>
      </AdminWorkspaceFrame>,
    );

    expect(markup).toContain('class="admin-workspace-frame"');
    expect(markup).toContain('aria-labelledby="admin-page-title"');
    expect(markup).not.toContain("<h1");
  });

  it("renders one page identity heading in the shared workspace band", () => {
    const markup = renderToStaticMarkup(
      <AdminWorkspaceBand
        kicker="Command Center"
        title="运营总览"
        description="平台运行信息"
        currentLabel="总览"
        currentDescription="平台健康、任务态势和风险告警。"
      />,
    );

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('<h1 id="admin-page-title">总览</h1>');
    expect(markup).toContain("运营总览 · Command Center");
    expect(markup).not.toContain("admin-workspace-band__focus");
  });

  it("renders key summaries with text-backed semantic tones", () => {
    const markup = renderToStaticMarkup(
      <AdminSummaryStrip
        label="运行摘要"
        items={[
          { label: "成员", value: 12, detail: "总数 14", icon: Users, tone: "success" },
          { label: "运行任务", value: 2, detail: "需要关注", icon: Activity, tone: "warning" },
        ]}
      />,
    );

    expect(markup).toContain('aria-label="运行摘要"');
    expect(markup).toContain('data-tone="success"');
    expect(markup).toContain('data-tone="warning"');
    expect(markup).toContain("成员");
    expect(markup).toContain("需要关注");
  });

  it("maps legacy Starlight variables onto the Admin Foundation token source", () => {
    const mainSource = readFileSync(resolve(__dirname, "main.tsx"), "utf8");
    const foundationStyles = readFileSync(resolve(__dirname, "styles", "admin-foundation.css"), "utf8");

    expect(mainSource).toContain('styles/admin-foundation.css');
    expect(foundationStyles).toContain("--admin-bg-base: #06111b");
    expect(foundationStyles).toContain("--admin-gradient-brand: linear-gradient(135deg, #35e6da, #4f9cff)");
    expect(foundationStyles).toContain("--starlight-bg: var(--admin-bg-base)");
    expect(foundationStyles).toContain("--starlight-panel: var(--admin-surface-1)");
    expect(foundationStyles).toContain("--starlight-cyan: var(--admin-brand-primary)");
    expect(foundationStyles).toContain("--starlight-success: var(--admin-success)");
    expect(foundationStyles).toContain(".admin-summary-strip");
    expect(foundationStyles).toContain("background: var(--admin-gradient-shell)");
    expect(foundationStyles).toMatch(/\.admin-workspace-frame[\s\S]*?\.data-panel[\s\S]*?background:\s*var\(--admin-surface-1\)/);
  });
});
