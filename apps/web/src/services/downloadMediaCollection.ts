export interface DownloadMediaCollectionOptions {
  delayMs?: number;
}

export function uniqueDownloadUrls(urls: readonly string[]) {
  return Array.from(new Set(urls.map((url) => String(url || '').trim()).filter(Boolean)));
}

export function downloadMediaCollection(
  urls: readonly string[],
  options: DownloadMediaCollectionOptions = {},
) {
  if (typeof document === 'undefined') return 0;
  const uniqueUrls = uniqueDownloadUrls(urls);
  const delayMs = Math.max(0, options.delayMs ?? 120);
  uniqueUrls.forEach((url, index) => {
    window.setTimeout(() => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filenameFromUrl(url, index + 1);
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }, index * delayMs);
  });
  return uniqueUrls.length;
}

function filenameFromUrl(url: string, index: number) {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const name = decodeURIComponent(pathname.split('/').pop() || '').trim();
    if (name) return name.replace(/[\\/:*?"<>|]+/g, '_');
  } catch {
    // Fall back to a stable filename for malformed or relative URLs.
  }
  return `output-${index}`;
}
