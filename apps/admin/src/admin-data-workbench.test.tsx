import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AdminDataContext,
  AdminDataToolbar,
  AdminDataWorkbench,
} from "./admin-data-workbench";

describe("Admin data workbench", () => {
  it.each(["overview", "realtime", "analytics"] as const)(
    "renders the %s data template without taking page identity",
    (mode) => {
      const markup = renderToStaticMarkup(
        <AdminDataWorkbench label={`${mode} workbench`} mode={mode}>
          <div>content</div>
        </AdminDataWorkbench>,
      );

      expect(markup).toContain('data-admin-template="data"');
      expect(markup).toContain(`data-data-mode="${mode}"`);
      expect(markup).toContain(`aria-label="${mode} workbench"`);
      expect(markup).not.toContain("<h1");
    },
  );

  it("renders one context with semantic status, actions, and metadata", () => {
    const markup = renderToStaticMarkup(
      <AdminDataContext
        eyebrow="Current window"
        title="Realtime tasks"
        description="Current-page values"
        status={{ label: "Live", tone: "success" }}
        actions={<button type="button">Refresh</button>}
        meta={<span>Updated now</span>}
      />,
    );

    expect(markup).toContain('class="admin-data-context"');
    expect(markup).toContain('class="status-pill success"');
    expect(markup).toContain("Realtime tasks");
    expect(markup).toContain("Current-page values");
    expect(markup).toContain("Refresh");
    expect(markup).toContain("Updated now");
    expect(markup).not.toContain("<h1");
  });

  it("renders an accessible unframed toolbar boundary", () => {
    const markup = renderToStaticMarkup(
      <AdminDataToolbar label="Task filters">
        <select aria-label="Status"><option>All</option></select>
      </AdminDataToolbar>,
    );

    expect(markup).toContain('class="admin-data-toolbar"');
    expect(markup).toContain('aria-label="Task filters"');
    expect(markup).toContain('aria-label="Status"');
  });
});
