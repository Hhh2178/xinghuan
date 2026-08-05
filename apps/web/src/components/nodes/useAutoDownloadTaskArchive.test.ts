import { describe, expect, it } from 'vitest';
import {
  shouldContinueArchivePolling,
  shouldSkipPersistedArchiveDownload,
  shouldTriggerAutomaticArchiveDownload,
} from './useAutoDownloadTaskArchive';

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
