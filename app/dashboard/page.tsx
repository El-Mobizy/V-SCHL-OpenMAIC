'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { Course, CourseProgress } from '@/lib/types/school';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<number, CourseProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const courseList = await api.courses.list(user.id);
        setCourses(courseList);

        const progressMap: Record<number, CourseProgress> = {};
        await Promise.all(
          courseList.map(async (c) => {
            try {
              progressMap[c.id] = await api.courses.progress.get(user.id, c.id);
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
      <div>
        <h1 className="text-2xl font-bold">My Courses</h1>
        <p className="text-muted-foreground">
          {user?.department} — {user?.program} — Level {user?.level}
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">No courses assigned yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const p = progress[course.id];
            const progressPercent = p
              ? Math.round((p.completed_scenes.length / p.total_scenes) * 100)
              : 0;
            const hasStarted = !!p;

            return (
              <div
                key={course.id}
                className="border rounded-lg p-5 bg-card hover:shadow-md transition-shadow space-y-3"
              >
                <h3 className="font-semibold">{course.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {course.description}
                </p>

                {hasStarted && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => router.push(`/course/${course.id}`)}
                >
                  {hasStarted ? 'Continue' : 'Start'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
