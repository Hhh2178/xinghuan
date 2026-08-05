import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAutomaticArchiveDownloadMarker,
  readAutomaticArchiveDownloadMarker,
  shouldContinueArchivePolling,
  shouldSkipPersistedArchiveDownload,
  shouldTriggerAutomaticArchiveDownload,
  writeAutomaticArchiveDownloadMarker,
} from './useAutoDownloadTaskArchive';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('automatic archive download marker', () => {
  it('survives a remount in the same browser and can be cleared by retry', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });

    expect(readAutomaticArchiveDownloadMarker('task-1')).toBeUndefined();
    writeAutomaticArchiveDownloadMarker('task-1', 'archive-1');
    expect(readAutomaticArchiveDownloadMarker('task-1')).toBe('archive-1');
    clearAutomaticArchiveDownloadMarker('task-1');
    expect(readAutomaticArchiveDownloadMarker('task-1')).toBeUndefined();
  });
});

describe('shouldSkipPersistedArchiveDownload', () => {
  it('does not block an explicit retry even when the old job was downloaded', () => {
    expect(shouldSkipPersistedArchiveDownload('downloaded', false)).toBe(true);
    expect(shouldSkipPersistedArchiveDownload('downloaded', true)).toBe(false);
    expect(shouldSkipPersistedArchiveDownload('ready', false)).toBe(false);
  });
});

describe('shouldContinueArchivePolling', () => {
  it('keeps polling only while an archive is queued or running', () => {
    expect(shouldContinueArchivePolling('queued')).toBe(true);
    expect(shouldContinueArchivePolling('running')).toBe(true);
    expect(shouldContinueArchivePolling('ready')).toBe(false);
    expect(shouldContinueArchivePolling('downloaded')).toBe(false);
    expect(shouldContinueArchivePolling('failed')).toBe(false);
  });
});

describe('shouldTriggerAutomaticArchiveDownload', () => {
  it('downloads only when a ready archive has not been downloaded for this job', () => {
    expect(shouldTriggerAutomaticArchiveDownload('ready', false)).toBe(true);
    expect(shouldTriggerAutomaticArchiveDownload('ready', true)).toBe(false);
    expect(shouldTriggerAutomaticArchiveDownload('downloaded', false)).toBe(false);
    expect(shouldTriggerAutomaticArchiveDownload('running', false)).toBe(false);
  });
});
