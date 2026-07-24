export function shouldRunChannelHealthAutoRefresh(input: { enabled: boolean; visibilityState: DocumentVisibilityState }): boolean {
  return input.enabled && input.visibilityState === "visible";
}
