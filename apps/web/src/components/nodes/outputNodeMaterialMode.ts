export function shouldCollectOutputNodeUpstream(data: unknown): boolean {
  const value = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  return value.rhDuckDecoded !== true && value.ignoreUpstreamMaterials !== true;
}
