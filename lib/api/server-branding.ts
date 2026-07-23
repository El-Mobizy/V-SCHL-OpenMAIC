import type { SchoolBranding } from '@/lib/types/school';

export async function getServerBranding(): Promise<SchoolBranding | null> {
  // Branding is best-effort: every failure below already returns null and the app
  // falls back to the default theme. Two guards, both about not hanging.
  //
  // 1. No API configured. .dockerignore excludes .env*, so SYMFONY_API_URL is unset
  //    during `next build`. The template then produced the literal URL
  //    "undefined/api/school/branding". A plain fetch rejects on that in ~20ms, but
  //    inside Next's build-time fetch instrumentation (which `next: { revalidate }`
  //    opts into) the promise never settles. This layout is the ROOT layout, so every
  //    route awaited it and every route timed out after 60s, including the otherwise
  //    empty /_not-found. The build then exits non-zero and V-CLASS produces no image.
  if (!process.env.SYMFONY_API_URL) return null;

  try {
    const res = await fetch(`${process.env.SYMFONY_API_URL}/api/school/branding`, {
      next: { revalidate: 60 },
      // 2. Configured but unreachable or slow. This function is on the critical path
      //    of every server render, and had no timeout at all, so a stalled Symfony
      //    would hang page rendering indefinitely rather than degrade to no branding.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SchoolBranding;
  } catch {
    return null;
  }
}
