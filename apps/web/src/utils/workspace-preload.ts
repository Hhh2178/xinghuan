type IdleCallback = (callback: () => void) => number;

let workspacePreloadPromise: Promise<void> | null = null;

export function scheduleWorkspacePreload(input: {
  isAuthenticated: boolean;
  preload: () => Promise<unknown>;
  requestIdleCallback?: IdleCallback;
  setTimeout?: (callback: () => void, delay: number) => number;
}) {
  if (!input.isAuthenticated) return Promise.resolve(false);
  if (workspacePreloadPromise) return workspacePreloadPromise.then(() => true);

  const requestIdle = input.requestIdleCallback;
  const schedule = input.setTimeout || ((callback, delay) => window.setTimeout(callback, delay));
  workspacePreloadPromise = new Promise<void>((resolve) => {
    const run = () => {
      Promise.resolve(input.preload()).catch(() => undefined).then(() => resolve());
    };
    if (requestIdle) requestIdle(run);
    else schedule(run, 0);
  });
  return workspacePreloadPromise.then(() => true);
}

export function resetWorkspacePreloadForTests() {
  workspacePreloadPromise = null;
}
