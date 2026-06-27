import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const usersPanel = readFileSync(join(root, "apps", "admin", "src", "admin-users-panel.tsx"), "utf8");
const groupsSection = readFileSync(join(root, "apps", "admin", "src", "admin-user-groups-section.tsx"), "utf8");
const permissionsPanel = readFileSync(join(root, "apps", "admin", "src", "admin-permissions-panel.tsx"), "utf8");
const permissionsRail = readFileSync(join(root, "apps", "admin", "src", "admin-permissions-group-rail.tsx"), "utf8");
const permissionsSummary = readFileSync(join(root, "apps", "admin", "src", "admin-permissions-summary-strip.tsx"), "utf8");
const permissionsSavebar = readFileSync(join(root, "apps", "admin", "src", "admin-permissions-savebar.tsx"), "utf8");
const styles = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");

assert.match(usersPanel, /users-page--starlight/, "users panel should opt into Starlight governance skin");
assert.match(usersPanel, /users-governance-summary/, "users panel should expose governance summary cards");
assert.match(usersPanel, /users-governance-overview/, "users panel should expose a governance overview workspace");
assert.match(usersPanel, /users-governance-quick-grid/, "users panel should expose governance quick-link cards");
assert.match(groupsSection, /users-group-workbench--starlight/, "group workspace should use the phase 2 Starlight workbench shell");
assert.match(groupsSection, /users-group-card__summary/, "group cards should have a dedicated summary area");
assert.match(groupsSection, /users-group-card__action-row/, "group cards should keep actions in wrapping rows");
assert.match(permissionsPanel, /permissions-shell--starlight/, "permissions workspace should opt into phase 2 Starlight shell");
assert.match(permissionsPanel, /permissions-impact-panel/, "permissions workspace should expose a compact impact panel");
assert.match(permissionsRail, /permissions-groups-panel--starlight/, "permissions group rail should use Starlight panel styling");
assert.match(permissionsSummary, /permissions-summary-grid--starlight/, "permissions summary strip should expose Starlight summary grid");
assert.match(permissionsSavebar, /permissions-savebar--starlight/, "permissions savebar should expose Starlight savebar styling");

assert.match(styles, /\.users-governance-summary[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/, "governance summary should render a stable five-card strip on desktop");
assert.match(styles, /\.users-governance-overview/, "styles should include governance overview workspace rules");
assert.match(styles, /\.users-governance-quick-grid/, "styles should include governance quick grid rules");
assert.match(styles, /\.users-group-workbench--starlight/, "styles should include Starlight group workbench hook");
assert.match(styles, /\.users-group-card__action-row[\s\S]*flex-wrap:\s*wrap/, "group card action rows should wrap");
assert.match(styles, /\.permissions-shell--starlight/, "styles should include Starlight permissions shell hook");
assert.match(styles, /\.permissions-impact-panel/, "styles should include permissions impact panel rules");
assert.match(styles, /\.permissions-group-card__name[\s\S]*color:\s*#fff/, "permissions group names should render in readable white");

console.log("PASS admin governance center phase 2 contract");
