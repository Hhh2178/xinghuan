export function shouldCollectOutputNodeUpstream(data: unknown): boolean {
  const value = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  return value.rhDuckDecoded !== true && value.ignoreUpstreamMaterials !== true;
}

export interface PersistedOutputMediaSnapshot {
  images: string[];
  videos: string[];
  audios: string[];
}

export function readPersistedOutputMediaSnapshot(data: unknown): PersistedOutputMediaSnapshot {
  const value = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  return {
    images: collectUrls(value.imageUrl, value.imageUrls, value.urls),
    videos: collectUrls(value.videoUrl, value.videoUrls),
    audios: collectUrls(value.audioUrl, value.audioUrl_1, value.audioUrls),
  };
}

export function mergePersistedOutputMediaSnapshot(
  collected: PersistedOutputMediaSnapshot,
  data: unknown,
): PersistedOutputMediaSnapshot {
  const persisted = readPersistedOutputMediaSnapshot(data);
  return {
    images: collected.images.length > 0 ? collected.images : persisted.images,
    videos: collected.videos.length > 0 ? collected.videos : persisted.videos,
    audios: collected.audios.length > 0 ? collected.audios : persisted.audios,
  };
}

function collectUrls(...values: unknown[]): string[] {
  const output: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const url = value.trim();
    if (url && !output.includes(url)) output.push(url);
  };
  values.forEach((value) => {
    if (Array.isArray(value)) value.forEach(push);
    else push(value);
  });
  return output;
}
