import { mergeUniqueUrls, taskRunIds } from './generationTaskResume';

/** Return every persisted/current image task exactly once for stop/cancel flows. */
export function collectImageTaskIds(
  taskIds: unknown,
  currentTaskId: unknown,
  taskRuns: unknown,
): string[] {
  return mergeUniqueUrls(taskIds, [currentTaskId], taskRunIds(taskRuns));
}
