import { describe, expect, it } from "vitest";

import { resolvePostgresPoolConfig } from "./postgres-pool-config";

describe("postgres pool config", () => {
  it("keeps service defaults when env overrides are absent", () => {
    expect(
      resolvePostgresPoolConfig(
        {},
        {
          serviceEnvPrefix: "XINGHUAN_API",
          defaultMax: 5,
          defaultConnectionTimeoutMillis: 3000,
        },
      ),
    ).toEqual({
      max: 5,
      connectionTimeoutMillis: 3000,
    });
  });

  it("prefers service-specific overrides over shared postgres overrides", () => {
    expect(
      resolvePostgresPoolConfig(
        {
          XINGHUAN_POSTGRES_POOL_MAX: "8",
          XINGHUAN_POSTGRES_POOL_CONNECTION_TIMEOUT_MS: "4500",
          XINGHUAN_API_POSTGRES_POOL_MAX: "7",
          XINGHUAN_API_POSTGRES_POOL_CONNECTION_TIMEOUT_MS: "2500",
        },
        {
          serviceEnvPrefix: "XINGHUAN_API",
          defaultMax: 5,
          defaultConnectionTimeoutMillis: 3000,
        },
      ),
    ).toEqual({
      max: 7,
      connectionTimeoutMillis: 2500,
    });
  });

  it("falls back from invalid overrides and clamps unsafe values", () => {
    expect(
      resolvePostgresPoolConfig(
        {
          XINGHUAN_WORKER_POSTGRES_POOL_MAX: "200",
          XINGHUAN_WORKER_POSTGRES_POOL_CONNECTION_TIMEOUT_MS: "bad",
        },
        {
          serviceEnvPrefix: "XINGHUAN_WORKER",
          defaultMax: 3,
          defaultConnectionTimeoutMillis: 3000,
        },
      ),
    ).toEqual({
      max: 50,
      connectionTimeoutMillis: 3000,
    });
  });
});
