import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AdminGovernanceContext,
  AdminGovernanceLayout,
  AdminGovernanceToolbar,
  AdminGovernanceWorkbench,
} from "./admin-governance-workbench";

describe("Admin governance workbench", () => {
  it.each(["governance", "content", "automation"] as const)(
    "renders the %s template without taking page identity",
    (mode) => {
      const markup = renderToStaticMarkup(
        <AdminGovernanceWorkbench label={`${mode} workbench`} mode={mode}>
          <div>content</div>
        </AdminGovernanceWorkbench>,
      );

      expect(markup).toContain('data-admin-template="governance"');
      expect(markup).toContain(`data-governance-mode="${mode}"`);
      expect(markup).toContain(`aria-label="${mode} workbench"`);
      expect(markup).not.toContain("<h1");
    },
  );

  it("renders semantic context and only the supplied layout slots", () => {
    const contextMarkup = renderToStaticMarkup(
      <AdminGovernanceContext
        eyebrow="Current scope"
        title="Organization governance"
        description="Accounts and groups"
        status={{ label: "Ready", tone: "success" }}
        actions={<button type="button">Review</button>}
        meta={<span>28 accounts</span>}
      />,
    );
    const fullLayout = renderToStaticMarkup(
      <AdminGovernanceLayout rail={<nav>Directory</nav>} inspector={<aside>Impact</aside>}>
        <main>Editor</main>
      </AdminGovernanceLayout>,
    );
    const editorOnly = renderToStaticMarkup(
      <AdminGovernanceLayout>
        <main>Editor</main>
      </AdminGovernanceLayout>,
    );

    expect(contextMarkup).toContain('class="admin-governance-context"');
    expect(contextMarkup).toContain('class="status-pill success"');
    expect(contextMarkup).toContain("Organization governance");
    expect(contextMarkup).toContain("Review");
    expect(contextMarkup).toContain("28 accounts");
    expect(contextMarkup).not.toContain("<h1");
    expect(fullLayout).toContain('data-workbench-slot="rail"');
    expect(fullLayout).toContain('data-workbench-slot="editor"');
    expect(fullLayout).toContain('data-workbench-slot="inspector"');
    expect(editorOnly).toContain('data-workbench-slot="editor"');
    expect(editorOnly).not.toContain('data-workbench-slot="rail"');
    expect(editorOnly).not.toContain('data-workbench-slot="inspector"');
  });

  it("renders an accessible unframed toolbar boundary", () => {
    const markup = renderToStaticMarkup(
      <AdminGovernanceToolbar label="Governance filters">
        <select aria-label="Status"><option>All</option></select>
      </AdminGovernanceToolbar>,
    );

    expect(markup).toContain('class="admin-governance-toolbar"');
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Governance filters"');
    expect(markup).toContain('aria-label="Status"');
  });
});
