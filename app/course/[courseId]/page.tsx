'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { Course, CourseProgress } from '@/lib/types/school';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type ViewState = 'loading' | 'generating' | 'ready';

export default function CourseViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const courseUuid = String(params.courseId);

  const [course, setCourse] = useState<Course | null>(null);
  const [syllabus, setSyllabus] = useState<unknown>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const courseData = await api.courses.get(courseUuid);
        setCourse(courseData);

        let syllabusData: unknown = null;
        try {
          syllabusData = await api.courses.syllabus.get(courseUuid, user.student_uuid);
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== 'NOT_FOUND') throw e;
        }

        let progressData: CourseProgress | null = null;
        try {
          progressData = await api.courses.progress.get(user.student_uuid, courseUuid);
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== 'NOT_FOUND') throw e;
        }

        if (syllabusData) {
          setSyllabus(syllabusData);
          if (progressData) {
            setProgress(progressData);
            setCurrentScene(progressData.current_scene_index);
          }
          setViewState('ready');
        } else {
          setViewState('generating');
          await generateSyllabus(courseData);
        }
      } catch (err) {
        console.error('Failed to load course:', err);
      }
    })();
  }, [user, courseUuid]);

  async function generateSyllabus(courseData: Course) {
    if (!user) return;
    try {
      const requirement = `Course: ${courseData.title}\n\nDescription: ${courseData.description}\n\nObjectives:\n${courseData.objectives ?? 'No objectives set.'}`;

      const res = await fetch('/api/generate-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement, language: 'en-US' }),
      });

      if (!res.ok) throw new Error('Generation failed');
      const { pollUrl } = await res.json();

      // Poll until complete
      let result = null;
      while (!result) {
        await new Promise((r) => setTimeout(r, 5000));
        const pollRes = await fetch(pollUrl);
        const status = await pollRes.json();
        if (status.status === 'completed') {
          result = status.result;
        } else if (status.status === 'failed') {
          throw new Error(status.error ?? 'Generation failed');
        }
      }

      // Save to Symfony
      await api.courses.syllabus.save(courseUuid, user.student_uuid, result);
      setSyllabus(result);
      setViewState('ready');
    } catch (err) {
      console.error('Syllabus generation failed:', err);
    }
  }

  async function navigateScene(index: number) {
    if (!user) return;
    setCurrentScene(index);
    try {
      await api.courses.progress.update(user.student_uuid, courseUuid, index);
    } catch {
      // Progress update failed — non-critical
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (viewState === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Generating your personalized syllabus...</p>
        <p className="text-xs text-muted-foreground">This may take a minute</p>
      </div>
    );
  }

  const scenes = (syllabus as { scenes?: unknown[] } | null)?.scenes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-xl font-bold">{course?.title}</h1>
      </div>

      <div className="border rounded-lg p-6 bg-card min-h-[400px]">
        {scenes.length > 0 ? (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Lesson {currentScene + 1} of {scenes.length}
            </p>
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(scenes[currentScene], null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-muted-foreground">No content available.</p>
        )}
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentScene <= 0}
          onClick={() => navigateScene(currentScene - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button
          disabled={currentScene >= scenes.length - 1}
          onClick={() => navigateScene(currentScene + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
