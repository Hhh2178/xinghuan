/** Resolve the first readable image binding from owner-scoped upstream node data. */
export function collectFirstImageUrl(nodesData: unknown): string {
  const list = Array.isArray(nodesData) ? nodesData : nodesData ? [nodesData] : [];
  const text = (value: unknown): string => typeof value === 'string' && value.trim() ? value.trim() : '';
  for (const node of list) {
    const data = (node && typeof node === 'object' && 'data' in node && node.data && typeof node.data === 'object')
      ? node.data as Record<string, unknown>
      : {};
    const direct = text(data.imageUrl) || (data.uploadType === 'image' ? text(data.url) : '');
    if (direct) return direct;
    for (const key of ['imageUrls', 'urls', 'generatedImages'] as const) {
      const values = data[key];
      if (!Array.isArray(values)) continue;
      const found = values.find((value) => text(value));
      if (found) return text(found);
    }
    const firstFrame = text(data.firstFrameUrl) || text(data.lastFrameUrl);
    if (firstFrame) return firstFrame;
  }
  return '';
}
