import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

describe("admin model pricing visual contract", () => {
  const component = read("./admin-model-pricing-section.tsx");
  const editor = read("./admin-model-editor.tsx");
  const styles = read("./styles.css");

  it("uses the shared primary action and accessible switch structure", () => {
    expect(component).toContain('className="primary-action"');
    expect(component).not.toContain('className="primary"');
    expect(component).toContain('aria-label="参与计费"');
    expect(component).toContain('className="model-pricing-toggle__track"');
    expect(component).toContain('className="model-pricing-toggle__thumb"');
  });

  it("keeps pricing first in the expanded model window", () => {
    expect(editor.indexOf("<AdminModelPricingSection")).toBeGreaterThan(-1);
    expect(editor.indexOf("<AdminModelPricingSection")).toBeLessThan(editor.indexOf('<section className="schema-guide-card">'));
  });

  it("matches the admin form and surface sizing contract", () => {
    expect(styles).toMatch(/\.model-pricing-card\s*\{[\s\S]*?padding:\s*16px;[\s\S]*?border-radius:\s*14px;/);
    expect(styles).toMatch(/\.model-pricing-toggle input\s*\{[\s\S]*?width:\s*1px;[\s\S]*?height:\s*1px;/);
    expect(styles).toMatch(/\.model-pricing-grid input,[\s\S]*?\.model-pricing-grid select\s*\{[\s\S]*?height:\s*44px;/);
    expect(styles).toContain(".model-pricing-foot .primary-action:hover:not(:disabled)");
  });
});
