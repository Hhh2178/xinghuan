import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const typesPath = join(root, "apps", "api", "src", "material-access-types.ts");
const typesSource = existsSync(typesPath) ? readFileSync(typesPath, "utf8") : "";
assert.equal(existsSync(typesPath), true, "material-access-types.ts should exist");
assert.match(typesSource, /export type MaterialSource = "generation-library"/, "MaterialSource should include generation-library");
assert.match(typesSource, /export type MaterialAccessDisposition = "inline" \| "attachment"/, "disposition type should cover preview and download");
assert.match(typesSource, /export interface MaterialAccessDescriptor/, "descriptor type should exist");
assert.match(typesSource, /previewUrl:/, "descriptor should include previewUrl");
assert.match(typesSource, /downloadUrl:/, "descriptor should include downloadUrl");
assert.match(typesSource, /filename:/, "descriptor should include filename");

const servicePath = join(root, "apps", "api", "src", "material-access-service.ts");
const serviceSource = existsSync(servicePath) ? readFileSync(servicePath, "utf8") : "";
assert.equal(existsSync(servicePath), true, "material-access-service.ts should exist");
assert.match(serviceSource, /createMaterialAccessService/, "service factory should exist");
assert.match(serviceSource, /resolveGenerationLibraryMaterial/, "service should resolve generation-library items");
assert.match(serviceSource, /buildGenerationLibraryAccessDescriptor/, "service should build response descriptors");
assert.match(serviceSource, /disposition=inline/, "service should build inline preview urls");
assert.match(serviceSource, /disposition=attachment/, "service should build download urls");

const apiServerPath = join(root, "apps", "api", "src", "server.ts");
const apiServerSource = readFileSync(apiServerPath, "utf8");
const webApiPath = join(root, "apps", "web", "src", "services", "api.ts");
const webApiSource = readFileSync(webApiPath, "utf8");

assert.match(apiServerSource, /buildGenerationLibraryAccessDescriptor/, "server should enrich responses via access descriptors");
assert.match(apiServerSource, /materialAccessService\.buildGenerationLibraryAccessDescriptor/, "server should wire generation-library access metadata");

assert.match(webApiSource, /previewUrl\?: string;/, "web GenerationLibraryItem should include previewUrl");
assert.match(webApiSource, /downloadUrl\?: string;/, "web GenerationLibraryItem should include downloadUrl");
assert.match(webApiSource, /openUrl\?: string;/, "web GenerationLibraryItem should include openUrl");
assert.match(webApiSource, /filename\?: string;/, "web GenerationLibraryItem should include filename");
assert.match(webApiSource, /canDownload\?: boolean;/, "web GenerationLibraryItem should include canDownload");
assert.match(webApiSource, /isExpired\?: boolean;/, "web GenerationLibraryItem should include isExpired");

assert.match(apiServerSource, /generationLibraryContentMatch = url\.pathname\.match/, "server should expose generation-library content route");
assert.match(apiServerSource, /\\\/api\\\/materials\\\/generation-library\\\//, "server route should target generation-library material content");
assert.match(apiServerSource, /disposition === "attachment"/, "route should branch for attachment downloads");
assert.match(apiServerSource, /Content-Disposition/, "route should set download headers");
assert.match(apiServerSource, /MATERIAL_EXPIRED/, "route should distinguish expired assets");
assert.match(apiServerSource, /MATERIAL_ACCESS_DENIED|AUTH_REQUIRED|MATERIAL_NOT_FOUND/, "route should return explicit access errors");

console.log("PASS generation library material access contract");
