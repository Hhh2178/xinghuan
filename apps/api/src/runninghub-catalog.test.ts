import { describe, expect, it } from "vitest";

import { normalizeRunningHubCatalogItems } from "./runninghub-catalog.js";

describe("RunningHub catalog group filtering", () => {
  it("filters items assigned to disabled or missing groups", () => {
    const items = normalizeRunningHubCatalogItems([
      { id: "valid-item", title: "Valid", groupId: "enabled-group" },
      { id: "disabled-item", title: "Disabled", groupId: "disabled-group" },
      { id: "ungrouped-item", title: "Ungrouped" },
    ], "workflow", new Set(["enabled-group"]));

    expect(items.map((item) => item.id)).toEqual(["valid-item", "ungrouped-item"]);
    expect(items.find((item) => item.id === "valid-item")?.groupId).toBe("enabled-group");
    expect(items.find((item) => item.id === "ungrouped-item")?.groupId).toBeUndefined();
  });
});
