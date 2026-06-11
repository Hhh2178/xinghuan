const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";

async function main() {
  const home = await fetchText("/");
  const homeAssetPath = extractFirstAssetPath(home.text);
  const homeAsset = await fetchHeaders(homeAssetPath);

  const admin = await fetchText("/admin");
  const adminAssetPath = extractFirstAssetPath(admin.text, "/admin/assets/");
  const adminAsset = await fetchHeaders(adminAssetPath);

  const results = [
    ["GET / returns HTML", home.status === 200 && home.text.includes('<div id="root"></div>')],
    ["GET / cache-control disables HTML caching", isHtmlCacheDisabled(home.headers.get("cache-control"))],
    ["GET /assets/* keeps cache enabled", isAssetCacheEnabled(homeAsset.headers.get("cache-control"))],
    ["GET /admin returns HTML", admin.status === 200 && admin.text.includes('<div id="root"></div>')],
    ["GET /admin cache-control disables HTML caching", isHtmlCacheDisabled(admin.headers.get("cache-control"))],
    ["GET /admin/assets/* keeps cache enabled", isAssetCacheEnabled(adminAsset.headers.get("cache-control"))],
  ];

  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

async function fetchText(pathname) {
  const response = await fetch(toUrl(pathname));
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
  };
}

async function fetchHeaders(pathname) {
  const response = await fetch(toUrl(pathname));
  await response.arrayBuffer();
  return {
    status: response.status,
    headers: response.headers,
  };
}

function extractFirstAssetPath(html, expectedPrefix = "/assets/") {
  const matches = html.matchAll(/(?:src|href)="([^"]+)"/g);
  for (const match of matches) {
    const candidate = match[1];
    if (candidate.startsWith(expectedPrefix)) {
      return candidate;
    }
  }
  throw new Error(`No asset path found for prefix ${expectedPrefix}`);
}

function isHtmlCacheDisabled(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("no-store") || normalized.includes("no-cache") || normalized.includes("max-age=0");
}

function isAssetCacheEnabled(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("public") && normalized.includes("max-age=");
}

function toUrl(pathname) {
  return new URL(pathname, baseUrl).toString();
}

await main();
