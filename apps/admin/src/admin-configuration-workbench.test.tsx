import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminConfigurationContext,
  AdminConfigurationLayout,
  AdminConfigurationSaveBar,
  AdminConfigurationWorkbench,
} from "./admin-configuration-workbench";

describe("Admin configuration workbench", () => {
  it("renders one shell-compatible object context and neutral workbench slots", () => {
    const markup = renderToStaticMarkup(
      <AdminConfigurationWorkbench label="Provider configuration">
        <AdminConfigurationContext
          eyebrow="Selected provider"
          title="Example API"
          description="https://api.example.com/v1"
          status={{ label: "Draft changed", tone: "warning" }}
          actions={<button type="button">Probe</button>}
        />
        <AdminConfigurationLayout
          rail={<nav>Provider catalog</nav>}
          inspector={<aside>Probe result</aside>}
        >
          <form>Provider fields</form>
        </AdminConfigurationLayout>
      </AdminConfigurationWorkbench>,
    );

    expect(markup).toContain('data-admin-template="configuration"');
    expect(markup).toContain('aria-label="Provider configuration"');
    expect(markup).toContain('class="admin-configuration-context"');
    expect(markup).not.toContain("<h1");
    expect(markup).toContain('data-workbench-slot="rail"');
    expect(markup).toContain('data-workbench-slot="editor"');
    expect(markup).toContain('data-workbench-slot="inspector"');
    expect(markup).toContain('data-tone="warning"');
  });

  it("keeps reset and save actions disabled until the caller reports a dirty draft", () => {
    const cleanMarkup = renderToStaticMarkup(
      <AdminConfigurationSaveBar
        dirty={false}
        saving={false}
        onReset={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const dirtyMarkup = renderToStaticMarkup(
      <AdminConfigurationSaveBar
        dirty
        saving={false}
        onReset={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(cleanMarkup).toContain("Configuration synchronized");
    expect(cleanMarkup.match(/disabled=""/g)).toHaveLength(2);
    expect(dirtyMarkup).toContain("Unsaved configuration changes");
    expect(dirtyMarkup).not.toContain('disabled=""');
  });
});
