import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressReporter } from '@/lib/hooks/use-progress-reporter';
import { api } from '@/lib/api/symfony';

vi.mock('@/lib/api/symfony', () => ({
  api: {
    courses: {
      progress: {
        update: vi.fn(),
        get: vi.fn(),
      },
    },
  },
}));

const mockUpdate = vi.mocked(api.courses.progress.update);

describe('useProgressReporter', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  const scenes = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

  it('posts the scene index when reportCompletion is called', async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() =>
      useProgressReporter({ studentUuid: 'stu', courseUuid: 'crs', scenes }),
    );
    await act(async () => {
      await result.current.reportCompletion('s2');
    });
    expect(mockUpdate).toHaveBeenCalledWith('stu', 'crs', 1);
  });

  it('ignores unknown scene ids', async () => {
    const { result } = renderHook(() =>
      useProgressReporter({ studentUuid: 'stu', courseUuid: 'crs', scenes }),
    );
    await act(async () => {
      await result.current.reportCompletion('nope');
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips when studentUuid is empty', async () => {
    const { result } = renderHook(() =>
      useProgressReporter({ studentUuid: '', courseUuid: 'crs', scenes }),
    );
    await act(async () => {
      await result.current.reportCompletion('s1');
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips when courseUuid is null', async () => {
    const { result } = renderHook(() =>
      useProgressReporter({ studentUuid: 'stu', courseUuid: null, scenes }),
    );
    await act(async () => {
      await result.current.reportCompletion('s1');
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('swallows API errors and does not throw', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() =>
      useProgressReporter({ studentUuid: 'stu', courseUuid: 'crs', scenes }),
    );
    await act(async () => {
      await result.current.reportCompletion('s1');
    });
    expect(mockUpdate).toHaveBeenCalled();
  });
});
