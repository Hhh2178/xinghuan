import { useEffect, useRef } from "react";

export function useAdminChangeStream(input: { isAdmin: boolean; onChange: (domains: string[]) => void }) {
  const onChangeRef = useRef(input.onChange);
  onChangeRef.current = input.onChange;
  useEffect(() => {
    if (!input.isAdmin || typeof window === "undefined" || typeof EventSource === "undefined") return;
    let source: EventSource | undefined;
    let stopped = false;
    let retry = 1000;
    const seen = new Map<string, number>();
    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/admin/changes/stream", { withCredentials: true });
      source.addEventListener("snapshot", (event) => {
        try {
          const rows = JSON.parse((event as MessageEvent).data) as Array<{ domain: string; revision: number }>;
          const changed = rows.filter((row) => seen.has(row.domain) && seen.get(row.domain) !== row.revision).map((row) => row.domain);
          for (const row of rows) seen.set(row.domain, row.revision);
          if (changed.length) onChangeRef.current(changed);
          retry = 1000;
        } catch { /* ignore malformed freshness events */ }
      });
      source.onerror = () => {
        source?.close();
        if (!stopped) { const delay = retry; retry = Math.min(15000, retry * 2); window.setTimeout(connect, delay); }
      };
    };
    connect();
    const onVisibility = () => { if (document.visibilityState === "visible") { source?.close(); connect(); } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stopped = true; source?.close(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [input.isAdmin]);
}
