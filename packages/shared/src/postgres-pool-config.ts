export interface PostgresPoolConfigDefaults {
  serviceEnvPrefix: string;
  defaultMax: number;
  defaultConnectionTimeoutMillis: number;
}

export interface PostgresPoolConfig {
  max: number;
  connectionTimeoutMillis: number;
}

const DEFAULT_MIN_POOL_MAX = 1;
const DEFAULT_MAX_POOL_MAX = 50;
const DEFAULT_MIN_TIMEOUT_MS = 500;
const DEFAULT_MAX_TIMEOUT_MS = 60000;

export function resolvePostgresPoolConfig(
  env: Record<string, string | undefined>,
  defaults: PostgresPoolConfigDefaults,
): PostgresPoolConfig {
  const sharedMax = env.XINGHUAN_POSTGRES_POOL_MAX;
  const sharedTimeout = env.XINGHUAN_POSTGRES_POOL_CONNECTION_TIMEOUT_MS;
  const serviceMax = env[`${defaults.serviceEnvPrefix}_POSTGRES_POOL_MAX`];
  const serviceTimeout = env[`${defaults.serviceEnvPrefix}_POSTGRES_POOL_CONNECTION_TIMEOUT_MS`];

  return {
    max: parseBoundedInteger(serviceMax ?? sharedMax, defaults.defaultMax, DEFAULT_MIN_POOL_MAX, DEFAULT_MAX_POOL_MAX),
    connectionTimeoutMillis: parseBoundedInteger(
      serviceTimeout ?? sharedTimeout,
      defaults.defaultConnectionTimeoutMillis,
      DEFAULT_MIN_TIMEOUT_MS,
      DEFAULT_MAX_TIMEOUT_MS,
    ),
  };
}

function parseBoundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
