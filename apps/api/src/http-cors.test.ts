import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { resolveCorsHeaders } from "./http-cors.js";

function request(headers: Record<string, string>) {
  return { headers } as IncomingMessage;
}

describe("resolveCorsHeaders", () => {
  const environment = {
    XINGHUAN_CORS_ALLOWED_ORIGINS: "https://zezhen.xyz, https://gray.zezhen.xyz",
  };

  it("allows configured browser origins", () => {
    expect(resolveCorsHeaders(
      request({
        origin: "https://gray.zezhen.xyz",
        "x-forwarded-host": "files.zezhen.xyz",
        "x-forwarded-proto": "https",
      }),
      environment,
    )).toEqual({
      "access-control-allow-origin": "https://gray.zezhen.xyz",
      "access-control-allow-credentials": "true",
      vary: "Origin",
    });
  });

  it("allows same-origin requests without an environment allowlist entry", () => {
    expect(resolveCorsHeaders(
      request({
        origin: "https://zezhen.xyz",
        "x-forwarded-host": "zezhen.xyz",
        "x-forwarded-proto": "https",
      }),
      {},
    )).toMatchObject({ "access-control-allow-origin": "https://zezhen.xyz" });
  });

  it("does not grant CORS to untrusted or origin-less requests", () => {
    expect(resolveCorsHeaders(
      request({
        origin: "https://untrusted.example",
        "x-forwarded-host": "zezhen.xyz",
        "x-forwarded-proto": "https",
      }),
      environment,
    )).toEqual({});
    expect(resolveCorsHeaders(request({ host: "zezhen.xyz" }), environment)).toEqual({});
  });
});
