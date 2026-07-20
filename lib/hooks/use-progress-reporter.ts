import { useCallback } from 'react';
import { api } from '@/lib/api/symfony';

export interface UseProgressReporterArgs {
  studentUuid: string;
  courseUuid: string | null;
  scenes: Array<{ id: string }>;
}

export interface UseProgressReporterResult {
  reportCompletion: (sceneId: string) => Promise<void>;
}

export function useProgressReporter({
  studentUuid,
  courseUuid,
  scenes,
}: UseProgressReporterArgs): UseProgressReporterResult {
  const reportCompletion = useCallback(
    async (sceneId: string) => {
      if (!studentUuid || !courseUuid) return;
      const idx = scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return;
      try {
        await api.courses.progress.update(studentUuid, courseUuid, idx);
      } catch {
        // Fire-and-forget: a missed progress post must not crash the player.
      }
    },
    [studentUuid, courseUuid, scenes],
  );
  return { reportCompletion };
}
