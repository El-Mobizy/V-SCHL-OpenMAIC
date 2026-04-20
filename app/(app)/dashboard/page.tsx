'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { Course, CourseProgress } from '@/lib/types/school';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, ArrowRight, CheckCircle2, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'card' | 'list';
const VIEW_STORAGE_KEY = 'dashboard.courses.view';

function isViewMode(v: string | null): v is ViewMode {
  return v === 'card' || v === 'list';
}

function courseInitials(title: string): string {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-z0-9]/i.test(w[0]));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('card');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (isViewMode(stored)) setView(stored);
    } catch {
      // localStorage unavailable (privacy mode, SSR prefetch) — keep default
    }
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: courseList } = await api.courses.list({ studentUuid: user.student_uuid });
        setCourses(courseList);

        const progressMap: Record<string, CourseProgress> = {};
        await Promise.all(
          courseList.map(async (c) => {
            try {
              progressMap[c.uuid] = await api.courses.progress.get(user.student_uuid, c.uuid);
            } catch (e) {
              if (!(e instanceof ApiError) || e.code !== 'NOT_FOUND') throw e;
            }
          }),
        );
        setProgress(progressMap);
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold border-l-4 border-primary pl-3">My Courses</h1>
          <p className="text-muted-foreground mt-1">
            {[user?.department, user?.program, user?.level].filter(Boolean).join(' — ')}
          </p>
        </div>
        <div
          role="group"
          aria-label="View mode"
          className="inline-flex rounded-md border bg-card p-0.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => changeView('card')}
            aria-label="Card view"
            aria-pressed={view === 'card'}
            className={cn(
              'inline-flex items-center justify-center rounded-sm p-1.5 transition-colors',
              view === 'card'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => changeView('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
            className={cn(
              'inline-flex items-center justify-center rounded-sm p-1.5 transition-colors',
              view === 'list'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">No courses assigned yet.</p>
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => {
            const p = progress[course.uuid];
            const progressPercent = p
              ? Math.round((p.completed_scenes.length / p.total_scenes) * 100)
              : 0;
            const hasStarted = !!p;
            const isComplete = hasStarted && progressPercent >= 100;
            const initials = courseInitials(course.title);

            const go = () => router.push(`/course/${course.uuid}`);
            return (
              <div
                key={course.uuid}
                data-testid="course-card"
                role="group"
                className="group relative rounded-xl border bg-card overflow-hidden flex flex-col transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-background">
                  {course.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <>
                      <div
                        aria-hidden
                        className="absolute -top-10 -left-8 h-32 w-32 rounded-full bg-primary/40 blur-2xl"
                      />
                      <div
                        aria-hidden
                        className="absolute -bottom-10 -right-6 h-28 w-28 rounded-full bg-primary/25 blur-2xl"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-bold text-5xl leading-none tracking-tight text-primary/80 drop-shadow-sm translate-y-[0.05em]">
                          {initials}
                        </span>
                      </div>
                      <BookOpen
                        aria-hidden
                        className="absolute bottom-3 left-3 h-4 w-4 text-primary/50"
                      />
                    </>
                  )}

                  <span
                    className={cn(
                      'absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm',
                      isComplete
                        ? 'bg-green-500/15 text-green-700 dark:text-green-400 ring-1 ring-green-500/30'
                        : hasStarted
                          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                          : 'bg-background/80 text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    {isComplete ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </>
                    ) : hasStarted ? (
                      'In progress'
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        New
                      </>
                    )}
                  </span>
                </div>

                <div className="flex-1 flex flex-col gap-3 p-4">
                  <h3 className="font-semibold text-base leading-tight line-clamp-2">
                    {course.title}
                  </h3>

                  {hasStarted ? (
                    <div className="space-y-1.5 mt-auto">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-primary tabular-nums">
                          {progressPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto text-xs text-muted-foreground">Not started yet</div>
                  )}

                  <Button
                    variant={hasStarted && !isComplete ? 'default' : 'outline'}
                    size="sm"
                    onClick={go}
                    className="mt-1 w-full justify-between"
                  >
                    <span>{isComplete ? 'Review' : hasStarted ? 'Continue' : 'Start learning'}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ul
          data-testid="course-list"
          className="border rounded-lg bg-card divide-y overflow-hidden"
        >
          {courses.map((course) => {
            const p = progress[course.uuid];
            const progressPercent = p
              ? Math.round((p.completed_scenes.length / p.total_scenes) * 100)
              : 0;
            const hasStarted = !!p;

            return (
              <li
                key={course.uuid}
                data-testid="course-row"
                className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{course.title}</h3>
                </div>
                <div className="hidden sm:flex items-center gap-2 w-48 shrink-0">
                  {hasStarted ? (
                    <>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                        {progressPercent}%
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not started</span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => router.push(`/course/${course.uuid}`)}
                >
                  {hasStarted ? 'Continue' : 'Start'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
