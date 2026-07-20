export function appendGeneratedVideoUrls(existing: unknown, incoming: unknown): string[] {
  const result: string[] = [];
  for (const group of [existing, incoming]) {
    const values = Array.isArray(group) ? group : [group];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const url = value.trim();
      if (url && !result.includes(url)) result.push(url);
    }
  }
  return result;
}
