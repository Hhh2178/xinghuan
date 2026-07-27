import { afterEach, describe, expect, it, vi } from "vitest";
import { resetWorkspacePreloadForTests, scheduleWorkspacePreload } from "./workspace-preload";

describe("workspace preload", () => {
  afterEach(() => resetWorkspacePreloadForTests());

  it("does not preload before authentication", async () => {
    const preload = vi.fn(async () => undefined);
    await expect(scheduleWorkspacePreload({ isAuthenticated: false, preload })).resolves.toBe(false);
    expect(preload).not.toHaveBeenCalled();
  });

  it("schedules one idle preload after authentication", async () => {
    let run: (() => void) | undefined;
    const preload = vi.fn(async () => undefined);
    const scheduled = scheduleWorkspacePreload({ isAuthenticated: true, preload, requestIdleCallback: (callback) => { run = callback; return 1; } });
    expect(preload).not.toHaveBeenCalled();
    run?.();
    await expect(scheduled).resolves.toBe(true);
    expect(preload).toHaveBeenCalledOnce();
  });

  it("does not retry a failed preload", async () => {
    const preload = vi.fn(async () => { throw new Error("chunk failed"); });
    const requestIdleCallback = (callback: () => void) => { callback(); return 1; };
    await scheduleWorkspacePreload({ isAuthenticated: true, preload, requestIdleCallback });
    await scheduleWorkspacePreload({ isAuthenticated: true, preload, requestIdleCallback });
    expect(preload).toHaveBeenCalledOnce();
  });
});
