'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { fetchCourse, fetchSyllabus, fetchProgress, updateProgress, saveSyllabus } from '@/lib/api/symfony-client';
import type { Course, CourseProgress } from '@/lib/types/school';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type ViewState = 'loading' | 'generating' | 'ready';

export default function CourseViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const courseId = Number(params.courseId);

  const [course, setCourse] = useState<Course | null>(null);
  const [syllabus, setSyllabus] = useState<any>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [courseData, syllabusData] = await Promise.all([
          fetchCourse(courseId),
          fetchSyllabus(courseId, user.id),
        ]);
        setCourse(courseData);

        if (syllabusData) {
          setSyllabus(syllabusData);
          try {
            const prog = await fetchProgress(user.id, courseId);
            setProgress(prog);
            setCurrentScene(prog.current_scene_index);
          } catch {
            // No progress yet
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
  }, [user, courseId]);

  async function generateSyllabus(courseData: Course) {
    if (!user) return;
    try {
      const requirement = `Course: ${courseData.title}\n\nDescription: ${courseData.description}\n\nObjectives:\n${courseData.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;

      const res = await fetch('/api/generate-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement, language: 'en-US' }),
      });

      if (!res.ok) throw new Error('Generation failed');
      const { jobId, pollUrl } = await res.json();

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
      await saveSyllabus(courseId, user.id, result);
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
      await updateProgress(user.id, courseId, index);
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

  const scenes = syllabus?.scenes ?? [];

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
