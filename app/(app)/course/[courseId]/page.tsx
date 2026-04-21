'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { Course, CourseProgress } from '@/lib/types/school';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Sparkles,
  CheckCircle2,
  GraduationCap,
  AlertCircle,
  PlayCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeCourseHtml } from '@/lib/utils/sanitize-html';
import { getModelOverride } from '@/lib/stores/model-override';

type ViewState = 'loading' | 'error' | 'generating' | 'ready' | 'configuring';
type SyllabusRef = { classroomId: string };

type UnderstandingLevel = 'beginner' | 'some-exposure' | 'strong';
type ExplanationStyle = 'visual' | 'narrative' | 'technical';

interface StudentContext {
  understanding: UnderstandingLevel;
  weakestArea: string;
  style: ExplanationStyle;
}

const STYLE_META: Record<
  ExplanationStyle,
  { label: string; cost: string; detail: string; enableImages: boolean }
> = {
  visual: {
    label: 'Visual',
    cost: 'High',
    detail: 'Diagrams, imagery, and animated scenes. Richer but uses more tokens.',
    enableImages: true,
  },
  narrative: {
    label: 'Narrative',
    cost: 'Medium',
    detail: 'Story-driven prose with examples. Balanced token use.',
    enableImages: false,
  },
  technical: {
    label: 'Technical',
    cost: 'Low',
    detail: 'Concise, structured, reference-style. Lightest on tokens.',
    enableImages: false,
  },
};

const UNDERSTANDING_OPTIONS: Array<{ value: UnderstandingLevel; label: string; hint: string }> = [
  { value: 'beginner', label: 'Beginner', hint: 'New to this subject' },
  { value: 'some-exposure', label: 'Some exposure', hint: 'Familiar with the basics' },
  { value: 'strong', label: 'Strong', hint: 'Comfortable — want depth' },
];

const WEAKEST_AREA_QUICK_FILLS: string[] = [
  'I have zero knowledge',
  'The first part of the course',
  'Core concepts and terminology',
  'Practical applications',
  'Advanced or later topics',
];

function understandingLabel(v: UnderstandingLevel): string {
  return UNDERSTANDING_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function courseInitials(title: string): string {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-z0-9]/i.test(w[0]));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function extractClassroomId(syllabus: unknown): string | null {
  if (!syllabus || typeof syllabus !== 'object') return null;
  const s = syllabus as Record<string, unknown>;
  if (typeof s.classroomId === 'string' && s.classroomId.length > 0) return s.classroomId;
  if (typeof s.classroom_id === 'string' && s.classroom_id.length > 0) return s.classroom_id;
  const nested = s.result;
  if (nested && typeof nested === 'object') {
    const r = nested as Record<string, unknown>;
    if (typeof r.classroomId === 'string' && r.classroomId.length > 0) return r.classroomId;
  }
  return null;
}

function isHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<[a-z][\s\S]*?>/i.test(value);
}

export default function CourseViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const courseUuid = String(params.courseId);

  const [course, setCourse] = useState<Course | null>(null);
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState<string>('Starting');
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  const generationLockRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const courseData = await api.courses.get(
          courseUuid,
          user.student_uuid || undefined,
        );
        if (cancelled) return;
        setCourse(courseData);

        let existingClassroomId: string | null = null;
        try {
          const syllabusData = await api.courses.syllabus.get(courseUuid, user.student_uuid);
          existingClassroomId = extractClassroomId(syllabusData);
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== 'NOT_FOUND') throw e;
        }

        let progressData: CourseProgress | null = null;
        try {
          progressData = await api.courses.progress.get(user.student_uuid, courseUuid);
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== 'NOT_FOUND') throw e;
        }
        if (cancelled) return;
        if (progressData) setProgress(progressData);
        if (existingClassroomId) setClassroomId(existingClassroomId);
        setViewState('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load course:', err);
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong while loading this course.',
        );
        setViewState('error');
      }
    })();
    return () => {
      cancelled = true;
      pollAbortRef.current?.abort();
    };
  }, [user, courseUuid]);

  function startLesson() {
    if (!user || !course) return;

    if (classroomId) {
      router.push(`/classroom/${classroomId}`);
      return;
    }

    if (generationLockRef.current) return;
    setErrorMessage(null);
    setViewState('configuring');
  }

  async function beginGeneration(context: StudentContext) {
    if (!user || !course) return;
    if (generationLockRef.current) return;
    generationLockRef.current = true;

    setViewState('generating');
    setGenerationStep('Starting');
    setGenerationProgress(0);
    setErrorMessage(null);

    const abort = new AbortController();
    pollAbortRef.current = abort;

    try {
      const styleMeta = STYLE_META[context.style];
      const contextBlock = [
        'Student context:',
        `- Current understanding: ${understandingLabel(context.understanding)}`,
        `- Weakest area: ${context.weakestArea.trim() || 'not specified'}`,
        `- Preferred explanation style: ${styleMeta.label.toLowerCase()} (${styleMeta.detail})`,
        '',
        'Tailor pacing, examples, and depth to match this profile.',
      ].join('\n');

      const requirement =
        `Course: ${course.title}\n\n` +
        `Description: ${course.description}\n\n` +
        `Objectives:\n${course.objectives ?? 'No objectives set.'}\n\n` +
        contextBlock;

      const modelString = user.student_uuid ? getModelOverride(user.student_uuid) : null;

      const res = await fetch('/api/generate-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement,
          language: 'en-US',
          enableImageGeneration: styleMeta.enableImages,
          courseUuid: course.uuid,
          ...(modelString ? { modelString } : {}),
        }),
        signal: abort.signal,
      });

      if (!res.ok) throw new Error('Failed to start generation');
      const body = await res.json();
      const pollUrl: string | undefined = body.pollUrl;
      if (!pollUrl) throw new Error('No pollUrl returned');

      let newClassroomId: string | null = null;
      while (!newClassroomId) {
        await new Promise((r) => setTimeout(r, 5000));
        if (abort.signal.aborted) throw new Error('Cancelled');

        const pollRes = await fetch(pollUrl, { signal: abort.signal });
        if (!pollRes.ok) throw new Error('Poll failed');
        const status = await pollRes.json();

        if (typeof status.message === 'string') setGenerationStep(status.message);
        if (typeof status.progress === 'number') {
          setGenerationProgress(Math.max(0, Math.min(100, status.progress)));
        }

        if (status.status === 'succeeded') {
          newClassroomId = status.result?.classroomId ?? null;
          if (!newClassroomId) throw new Error('Generation succeeded but returned no classroom id');
        } else if (status.status === 'failed') {
          throw new Error(status.error ?? 'Generation failed');
        }
      }

      try {
        await api.courses.syllabus.save(courseUuid, user.student_uuid, {
          classroomId: newClassroomId,
        } satisfies SyllabusRef);
      } catch (saveErr) {
        console.warn(
          '[course] Failed to persist syllabus pointer; classroom still reachable.',
          saveErr,
        );
      }

      setClassroomId(newClassroomId);
      router.push(`/classroom/${newClassroomId}`);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.error('Syllabus generation failed:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Syllabus generation failed. Please try again.',
      );
      setViewState('error');
      generationLockRef.current = false;
    }
  }

  const initials = course ? courseInitials(course.title) : '';
  const progressPercent =
    progress && progress.total_scenes > 0
      ? Math.round((progress.completed_scenes.length / progress.total_scenes) * 100)
      : 0;
  const hasStarted = progress !== null;
  const isComplete = hasStarted && progressPercent >= 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {course && (
          <>
            <span aria-hidden className="text-muted-foreground/60 text-sm">
              /
            </span>
            <h1 className="text-sm font-medium text-muted-foreground truncate">
              {course.title}
            </h1>
          </>
        )}
      </div>

      {viewState === 'loading' && <CourseLoadingShell />}

      {viewState === 'error' && !course && (
        <CourseLoadError
          message={errorMessage}
          onBack={() => router.push('/dashboard')}
        />
      )}

      {course && viewState !== 'loading' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_1fr] gap-6 lg:gap-8">
          <CourseAside
            course={course}
            initials={initials}
            hasStarted={hasStarted}
            isComplete={isComplete}
            progressPercent={progressPercent}
            classroomReady={classroomId != null}
          />

          <section className="min-w-0 space-y-6">
            <CourseHero
              course={course}
              classroomReady={classroomId != null}
              hasStarted={hasStarted}
              isComplete={isComplete}
              viewState={viewState}
              onStart={startLesson}
            />

            {viewState === 'configuring' && (
              <ContextForm
                onSubmit={(ctx) => void beginGeneration(ctx)}
                onCancel={() => setViewState('ready')}
              />
            )}

            {viewState === 'generating' && (
              <SyllabusGenerating step={generationStep} progress={generationProgress} />
            )}

            {viewState === 'error' && errorMessage && course && (
              <GenerationErrorBanner
                message={errorMessage}
                onRetry={() => {
                  setErrorMessage(null);
                  setViewState('ready');
                }}
              />
            )}

            <CourseDescriptionCard description={course.description} />

            {course.objectives && <ObjectivesCard objectives={course.objectives} />}
          </section>
        </div>
      )}
    </div>
  );
}

// --- Left aside: course details ---------------------------------------------

function CourseAside({
  course,
  initials,
  hasStarted,
  isComplete,
  progressPercent,
  classroomReady,
}: {
  course: Course;
  initials: string;
  hasStarted: boolean;
  isComplete: boolean;
  progressPercent: number;
  classroomReady: boolean;
}) {
  return (
    <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border bg-gradient-to-br from-primary/30 via-primary/10 to-background shadow-sm">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:18px_18px] text-primary"
        />
        <div
          aria-hidden
          className="absolute -top-12 -left-10 h-44 w-44 rounded-full bg-primary/50 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-14 -right-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold text-[5.5rem] leading-none tracking-tight text-primary/85 drop-shadow-sm">
            {initials}
          </span>
        </div>
        <BookOpen
          aria-hidden
          className="absolute bottom-4 left-4 h-5 w-5 text-primary/60"
        />
        <span
          className={cn(
            'absolute top-4 right-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm ring-1',
            isComplete
              ? 'bg-green-500/15 text-green-700 dark:text-green-400 ring-green-500/30'
              : hasStarted
                ? 'bg-primary/15 text-primary ring-primary/30'
                : classroomReady
                  ? 'bg-primary/10 text-primary ring-primary/25'
                  : 'bg-background/80 text-muted-foreground ring-border',
          )}
        >
          {isComplete ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </>
          ) : hasStarted ? (
            'In progress'
          ) : classroomReady ? (
            <>
              <PlayCircle className="h-3 w-3" />
              Ready
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              New
            </>
          )}
        </span>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold leading-tight tracking-tight">{course.title}</h2>
        {course.code && (
          <div className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
            {course.code}
          </div>
        )}
      </div>

      {hasStarted && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-muted-foreground uppercase tracking-wider font-medium">
              Progress
            </span>
            <span className="font-semibold text-primary tabular-nums">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t">
        <MetaItem label="Department" value={course.department} />
        <MetaItem label="Program" value={course.program} />
        <MetaItem label="Level" value={course.level} />
        <MetaItem
          label="Units"
          value={course.units != null ? String(course.units) : null}
        />
      </dl>
    </aside>
  );
}

function MetaItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5 min-w-0">
      <dt className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </dt>
      <dd className="text-sm font-medium truncate">{value}</dd>
    </div>
  );
}

// --- Right: main content -----------------------------------------------------

function CourseHero({
  course,
  classroomReady,
  hasStarted,
  isComplete,
  viewState,
  onStart,
}: {
  course: Course;
  classroomReady: boolean;
  hasStarted: boolean;
  isComplete: boolean;
  viewState: ViewState;
  onStart: () => void;
}) {
  const generating = viewState === 'generating';
  const configuring = viewState === 'configuring';
  const cta = isComplete
    ? 'Review lesson'
    : hasStarted
      ? 'Continue lesson'
      : classroomReady
        ? 'Enter classroom'
        : 'Start lesson';

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px] text-foreground"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative p-6 lg:p-8 space-y-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          <span className="h-px w-5 bg-primary/50" />
          <span>{course.department ?? 'Course'}</span>
          {course.level && (
            <>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span>{course.level}</span>
            </>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl lg:text-[2rem] font-bold leading-[1.15] tracking-tight">
            {course.title}
          </h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            An interactive, AI-guided classroom tailored to your program. Rich
            explanations, visuals, and knowledge checks &mdash; ready when you are.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            size="lg"
            onClick={onStart}
            disabled={generating || configuring}
            className="group relative shadow-md shadow-primary/20 font-medium"
          >
            {generating ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin mr-2" />
                Preparing your classroom
              </>
            ) : configuring ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Fill out setup below
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                {cta}
                <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>

          {!classroomReady && !generating && !configuring && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              First launch asks a few quick questions &mdash; about a minute to generate.
            </span>
          )}

          {classroomReady && !generating && !configuring && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Your classroom is ready to pick up.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CourseDescriptionCard({ description }: { description: string }) {
  const html = isHtml(description);
  const safeHtml = useMemo(
    () => (html ? sanitizeCourseHtml(description) : ''),
    [html, description],
  );

  return (
    <div className="rounded-2xl border bg-card p-6 lg:p-8 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">About this course</h3>
      </div>

      {html ? (
        <div
          className="course-html text-[15px] leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      ) : (
        <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-line">
          {description}
        </p>
      )}

      <style jsx>{`
        .course-html :global(p) {
          margin: 0.75rem 0;
        }
        .course-html :global(p:first-child) {
          margin-top: 0;
        }
        .course-html :global(p:last-child) {
          margin-bottom: 0;
        }
        .course-html :global(h1),
        .course-html :global(h2),
        .course-html :global(h3),
        .course-html :global(h4) {
          font-weight: 600;
          letter-spacing: -0.01em;
          margin: 1.25rem 0 0.5rem;
          line-height: 1.3;
        }
        .course-html :global(h1) {
          font-size: 1.25rem;
        }
        .course-html :global(h2) {
          font-size: 1.125rem;
        }
        .course-html :global(h3),
        .course-html :global(h4) {
          font-size: 1rem;
        }
        .course-html :global(ul),
        .course-html :global(ol) {
          margin: 0.75rem 0;
          padding-left: 1.25rem;
        }
        .course-html :global(ul) {
          list-style: disc;
        }
        .course-html :global(ol) {
          list-style: decimal;
        }
        .course-html :global(li) {
          margin: 0.25rem 0;
        }
        .course-html :global(li)::marker {
          color: var(--primary, #6366f1);
        }
        .course-html :global(a) {
          color: var(--primary, #6366f1);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .course-html :global(strong) {
          font-weight: 600;
        }
        .course-html :global(em) {
          font-style: italic;
        }
        .course-html :global(blockquote) {
          border-left: 3px solid var(--primary, #6366f1);
          padding-left: 1rem;
          color: rgba(0, 0, 0, 0.7);
          margin: 1rem 0;
          font-style: italic;
        }
        .course-html :global(code) {
          background: rgba(127, 127, 127, 0.12);
          padding: 0.1rem 0.35rem;
          border-radius: 0.25rem;
          font-family:
            ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.875em;
        }
        .course-html :global(pre) {
          background: rgba(127, 127, 127, 0.08);
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 0.75rem 0;
        }
        .course-html :global(img) {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 0.75rem 0;
        }
        .course-html :global(hr) {
          border: 0;
          border-top: 1px solid rgba(127, 127, 127, 0.2);
          margin: 1.5rem 0;
        }
        .course-html :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.9em;
        }
        .course-html :global(th),
        .course-html :global(td) {
          padding: 0.5rem 0.75rem;
          border: 1px solid rgba(127, 127, 127, 0.2);
          text-align: left;
        }
        .course-html :global(th) {
          font-weight: 600;
          background: rgba(127, 127, 127, 0.08);
        }
      `}</style>
    </div>
  );
}

function ObjectivesCard({ objectives }: { objectives: string }) {
  const items = objectives
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•\d+.\s]+/, '').trim())
    .filter(Boolean);

  return (
    <div className="rounded-2xl border bg-card p-6 lg:p-8 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
          <GraduationCap className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">Learning objectives</h3>
      </div>

      {items.length > 1 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-lg border bg-background/50 p-3 text-sm leading-relaxed"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary tabular-nums">
                {i + 1}
              </span>
              <span className="text-foreground/90">{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
          {objectives}
        </p>
      )}
    </div>
  );
}

// --- States ------------------------------------------------------------------

function CourseLoadingShell() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_1fr] gap-6 lg:gap-8">
      <aside className="space-y-5">
        <div className="aspect-[4/5] rounded-2xl bg-muted/40 animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4 border-t">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </aside>
      <section className="space-y-6">
        <div className="rounded-2xl border bg-card p-8 space-y-4">
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-2/3 bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-10 w-40 bg-muted rounded animate-pulse mt-4" />
        </div>
        <div className="rounded-2xl border bg-card p-8 space-y-3">
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-11/12 bg-muted rounded animate-pulse" />
          <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
        </div>
      </section>
    </div>
  );
}

function CourseLoadError({
  message,
  onBack,
}: {
  message: string | null;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-8 min-h-[320px] flex items-center justify-center text-center">
      <div className="max-w-sm space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">Unable to load this course</h3>
          <p className="text-sm text-muted-foreground">
            {message ?? 'Please try again in a moment.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

function GenerationErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-destructive">Generation failed</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        Try again
      </Button>
    </div>
  );
}

function ContextForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (ctx: StudentContext) => void;
  onCancel: () => void;
}) {
  const [understanding, setUnderstanding] = useState<UnderstandingLevel>('some-exposure');
  const [weakestArea, setWeakestArea] = useState('');
  const [style, setStyle] = useState<ExplanationStyle>('narrative');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ understanding, weakestArea, style });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-2xl border bg-card p-6 lg:p-8 space-y-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary font-semibold">
            <Sparkles className="h-3 w-3" />
            Before we generate
          </div>
          <h3 className="text-lg font-semibold tracking-tight">Tell us where you&rsquo;re starting from</h3>
          <p className="text-sm text-muted-foreground">
            A few quick signals so the AI can tune pacing, depth, and examples to you.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <FieldRow
          index={1}
          label="Current understanding"
          hint="How familiar are you with this subject right now?"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {UNDERSTANDING_OPTIONS.map((opt) => {
              const active = understanding === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setUnderstanding(opt.value)}
                  aria-pressed={active}
                  className={cn(
                    'group relative text-left rounded-xl border p-3 transition-all',
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        active ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {opt.label}
                    </span>
                    {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{opt.hint}</p>
                </button>
              );
            })}
          </div>
        </FieldRow>

        <FieldRow
          index={2}
          label="Weakest area"
          hint="Which concepts or sub-topics feel the shakiest? (optional)"
        >
          <textarea
            value={weakestArea}
            onChange={(e) => setWeakestArea(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="e.g. recursion, normalization, balancing equations…"
            className="w-full resize-none rounded-xl border bg-background px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/70 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {WEAKEST_AREA_QUICK_FILLS.map((q) => {
              const active = weakestArea === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setWeakestArea(active ? '' : q)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {q}
                </button>
              );
            })}
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {weakestArea.length}/400
            </span>
          </div>
        </FieldRow>

        <FieldRow
          index={3}
          label="Preferred explanation style"
          hint="Each option has a different token cost — pick whatever suits you."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(STYLE_META) as ExplanationStyle[]).map((value) => {
              const meta = STYLE_META[value];
              const active = style === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStyle(value)}
                  aria-pressed={active}
                  className={cn(
                    'relative text-left rounded-xl border p-3 transition-all',
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        active ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {meta.label}
                    </span>
                    <TokenCostBadge cost={meta.cost} active={active} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">{meta.detail}</p>
                </button>
              );
            })}
          </div>
        </FieldRow>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="group">
          <Sparkles className="h-4 w-4 mr-1.5" />
          Generate my classroom
          <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </form>
  );
}

function FieldRow({
  index,
  label,
  hint,
  children,
}: {
  index: number;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 sm:gap-5">
      <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 text-[11px] font-semibold text-primary tabular-nums">
        {index}
      </div>
      <div className="space-y-2 min-w-0">
        <div className="space-y-0.5">
          <label className="text-sm font-medium text-foreground">{label}</label>
          <p className="text-xs text-muted-foreground leading-snug">{hint}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function TokenCostBadge({ cost, active }: { cost: string; active: boolean }) {
  const tone =
    cost === 'High'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30'
      : cost === 'Medium'
        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400 ring-sky-500/30'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1',
        tone,
        !active && 'opacity-80',
      )}
    >
      {cost} tokens
    </span>
  );
}

function SyllabusGenerating({
  step,
  progress,
}: {
  step: string;
  progress: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/8 via-card to-card p-6 lg:p-8">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:14px_14px] text-primary"
      />
      <div className="relative flex items-start gap-5">
        <div className="relative h-14 w-14 shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
          <div className="relative h-full w-full rounded-2xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-base">Crafting your personalized classroom</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Reading objectives and generating interactive scenes. Usually takes about
              a minute &mdash; you&rsquo;ll be taken in automatically.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate pr-2">{step}</span>
              <span className="font-semibold text-primary tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
