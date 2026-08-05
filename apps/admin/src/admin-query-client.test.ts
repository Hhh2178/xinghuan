import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAdminQueryCache, invalidateAdminQueries, readAdminQuery } from "./admin-query-client";

describe("admin query client", () => {
  beforeEach(() => clearAdminQueryCache());

  it("merges concurrent reads for the same key", async () => {
    let calls = 0;
    let resolve!: (value: string) => void;
    const pending = new Promise<string>((done) => { resolve = done; });
    const loader = vi.fn(async () => {
      calls += 1;
      return pending;
    });

    const first = readAdminQuery(["providers"], loader, { maxAgeMs: 5_000 });
    const second = readAdminQuery(["providers"], loader, { maxAgeMs: 5_000 });
    resolve("ok");

    await expect(Promise.all([first, second])).resolves.toEqual(["ok", "ok"]);
    expect(calls).toBe(1);
  });

  it("serves a fresh value without starting another request", async () => {
    const loader = vi.fn(async () => "cached");
    await expect(readAdminQuery(["models"], loader, { maxAgeMs: 5_000 })).resolves.toBe("cached");
    await expect(readAdminQuery(["models"], loader, { maxAgeMs: 5_000 })).resolves.toBe("cached");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidates a query prefix", async () => {
    const loader = vi.fn(async (signal: AbortSignal) => {
      if (signal.aborted) throw new DOMException("aborted", "AbortError");
      return "value";
    });
    await readAdminQuery(["directory", "users"], loader, { maxAgeMs: 5_000 });
    invalidateAdminQueries(["directory"]);
    await readAdminQuery(["directory", "users"], loader, { maxAgeMs: 5_000 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("aborts an obsolete in-flight request when the same key is forced", async () => {
    const aborted = vi.fn();
    const loader = vi.fn((signal: AbortSignal) => new Promise<string>((resolve, reject) => {
      signal.addEventListener("abort", () => { aborted(); reject(new DOMException("aborted", "AbortError")); }, { once: true });
      setTimeout(() => resolve("fresh"), 10);
    }));
    const first = readAdminQuery(["route", "users"], loader, { maxAgeMs: 0 });
    const second = readAdminQuery(["route", "users"], loader, { maxAgeMs: 0, force: true });
    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    await expect(second).resolves.toBe("fresh");
    expect(aborted).toHaveBeenCalledTimes(1);
  });
});
