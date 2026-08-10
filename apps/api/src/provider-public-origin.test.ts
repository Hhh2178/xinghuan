import { describe, expect, it } from "vitest";
import { ProviderPublicOriginError, resolveProviderPublicOrigin } from "./provider-public-origin.js";

describe("provider public origin", () => {
  it("requires configured HTTPS origins in gray and production", () => {
    expect(resolveProviderPublicOrigin({ environment: "gray", configuredOrigin: "https://gray.example/" }))
      .toBe("https://gray.example");
    expect(() => resolveProviderPublicOrigin({ environment: "production", configuredOrigin: "http://prod.example" }))
      .toThrow(ProviderPublicOriginError);
    expect(() => resolveProviderPublicOrigin({ environment: "gray", requestOrigin: "https://attacker.example" }))
      .toThrow(ProviderPublicOriginError);
  });

  it("allows local fallback only to a normalized request origin", () => {
    expect(resolveProviderPublicOrigin({ environment: "local", requestOrigin: "http://localhost:3000/" }))
      .toBe("http://localhost:3000");
    expect(resolveProviderPublicOrigin({ environment: "local", configuredOrigin: "https://dev.example/path" , requestOrigin: "http://localhost:3000" }))
      .toBe("http://localhost:3000");
  });

  it("rejects credentials, paths, query strings and fragments", () => {
    for (const configuredOrigin of [
      "https://user:pass@example.com",
      "https://example.com/path",
      "https://example.com/?x=1",
      "https://example.com/#hash",
    ]) {
      expect(() => resolveProviderPublicOrigin({ environment: "production", configuredOrigin }))
        .toThrow(ProviderPublicOriginError);
    }
  });
});
