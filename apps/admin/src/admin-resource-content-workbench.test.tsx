import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminAnnouncementPanel } from "./admin-announcement-panel";
import { AdminPublicResourcesPanel } from "./admin-public-resources-panel";

const resourceSource = readFileSync(new URL("./admin-public-resources-panel.tsx", import.meta.url), "utf8");
const announcementSource = readFileSync(new URL("./admin-announcement-panel.tsx", import.meta.url), "utf8");

function expectOneTemplate(markup: string, mode: "governance" | "content") {
  expect([...markup.matchAll(/data-admin-template="governance"/g)]).toHaveLength(1);
  expect(markup).toContain(`data-governance-mode="${mode}"`);
  expect(markup).not.toContain("<h1");
}

describe("Admin resource and content workbenches", () => {
  it("renders resource directory, editor grid, upload, preview ownership, and empty state", () => {
    const markup = renderToStaticMarkup(<AdminPublicResourcesPanel />);

    expectOneTemplate(markup, "governance");
    expect(markup).toContain('data-workbench-slot="rail"');
    expect(markup).toContain('data-workbench-scroll="rail"');
    expect(markup).toContain('data-workbench-slot="editor"');
    expect(markup).toContain('data-resource-directory="type-selector"');
    expect(markup).toContain('data-resource-search="true"');
    expect(markup).toContain("上传本地资源");
    expect(markup).toContain("暂无公共资源");
    expect(resourceSource).toContain("onOpenPreview={() => setPreviewItem(item)}");
    expect(resourceSource).toContain("kind={kind}");
    expect(resourceSource).toContain("onSelectKind={(nextKind) =>");
    expect(resourceSource).toContain('label="公共资源搜索"');
    expect(resourceSource).not.toContain("AdminBandTabButton");
    expect(resourceSource).toContain("<AdminMediaPreviewModal");
    expect(resourceSource).toContain("adminSharedResourceApi.uploadFile");
    expect(resourceSource).toContain("window.confirm");
  });

  it("renders announcement directory, editor, preview, lifecycle states, and publish controls", () => {
    const markup = renderToStaticMarkup(
      <AdminAnnouncementPanel
        items={[]}
        loading={false}
        busy={false}
        onReload={() => undefined}
        onCreate={() => undefined}
        onUpdate={() => undefined}
        onPublish={() => undefined}
        onArchive={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expectOneTemplate(markup, "content");
    expect(markup).toContain('data-workbench-slot="rail"');
    expect(markup).toContain('data-workbench-slot="editor"');
    expect(markup).toContain('data-workbench-slot="inspector"');
    expect(markup).toContain("公告预览");
    expect(markup).toContain('<option value="draft" selected="">草稿</option>');
    expect(markup).toContain('<option value="published">已发布</option>');
    expect(markup).toContain('<option value="archived">已归档</option>');
    expect(announcementSource).toContain("confirmTitle:");
    expect(announcementSource).toContain("confirmStrongReminder:");
    expect(announcementSource).toContain("confirmPinned:");
    expect(announcementSource).toContain("onArchive(selectedItem.id)");
    expect(announcementSource).toContain("onDelete(selectedItem.id)");
    expect(announcementSource).toContain("disabled={busy || loading}");
  });
});
