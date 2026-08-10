type QueryKey = readonly unknown[];

export interface AdminQueryOptions {
  maxAgeMs: number;
  force?: boolean;
  signal?: AbortSignal;
}

interface QueryEntry<T> {
  key: string;
  value?: T;
  settledAt: number;
  promise?: Promise<T>;
  controller?: AbortController;
}

const entries = new Map<string, QueryEntry<unknown>>();

function serializeKey(key: QueryKey) {
  return JSON.stringify(key);
}

function abortError() {
  return new DOMException("The operation was aborted", "AbortError");
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export function readAdminQuery<T>(
  key: QueryKey,
  loader: (signal: AbortSignal) => Promise<T>,
  options: AdminQueryOptions,
): Promise<T> {
  const serializedKey = serializeKey(key);
  const current = entries.get(serializedKey) as QueryEntry<T> | undefined;
  const now = Date.now();
  if (!options.force && current?.promise) return withAbort(current.promise, options.signal);
  if (!options.force && current?.value !== undefined && now - current.settledAt <= Math.max(0, options.maxAgeMs)) {
    return withAbort(Promise.resolve(current.value), options.signal);
  }

  current?.controller?.abort();
  const controller = new AbortController();
  const entry: QueryEntry<T> = { key: serializedKey, settledAt: 0, controller };
  const promise = loader(controller.signal)
    .then((value) => {
      entry.value = value;
      entry.settledAt = Date.now();
      return value;
    })
    .catch((error) => {
      if (entries.get(serializedKey) === entry) entries.delete(serializedKey);
      throw error;
    })
    .finally(() => {
      if (entries.get(serializedKey) === entry) entry.promise = undefined;
    });
  entry.promise = promise;
  entries.set(serializedKey, entry);
  return withAbort(promise, options.signal);
}

export function invalidateAdminQueries(prefix: QueryKey) {
  const prefixText = JSON.stringify(prefix);
  for (const [key, entry] of entries) {
    if (key === prefixText || key.startsWith(`${prefixText.slice(0, -1)},`)) {
      entry.controller?.abort();
      entries.delete(key);
    }
  }
}

export function invalidateAdminQuery(key: QueryKey) {
  const serializedKey = serializeKey(key);
  const entry = entries.get(serializedKey);
  entry?.controller?.abort();
  entries.delete(serializedKey);
}

export function clearAdminQueryCache() {
  for (const entry of entries.values()) entry.controller?.abort();
  entries.clear();
}
