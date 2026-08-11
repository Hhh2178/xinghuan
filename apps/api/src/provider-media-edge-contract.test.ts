import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nginxConfig = readFileSync(new URL("../../../ops/nginx/zezhen.xyz.conf.example", import.meta.url), "utf8");

describe("provider media edge routing", () => {
  it("routes each scoped media path to its matching API environment", () => {
    expect((nginxConfig.match(/location \/api\/provider-media\/gray\//g) || []).length).toBe(2);
    expect((nginxConfig.match(/location \/api\/provider-media\/production\//g) || []).length).toBe(2);
    expect(scopedProxy("gray", "18200")).toBe(true);
    expect(scopedProxy("production", "18100")).toBe(true);
  });
});

function scopedProxy(scope: "gray" | "production", port: string) {
  const pattern = new RegExp(
    `location \\/api\\/provider-media\\/${scope}\\/ \\{[\\s\\S]*?proxy_pass http:\\/\\/127\\.0\\.0\\.1:${port};`,
  );
  return pattern.test(nginxConfig);
}
