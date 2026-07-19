'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// useSearchParams() requires a Suspense boundary for static prerender
export default function AdoptSupportPage() {
  return (
    <Suspense>
      <AdoptSupportForm />
    </Suspense>
  );
}

function AdoptSupportForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No support handoff code provided.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function exchange() {
      try {
        const res = await fetch('/api/support/handoff/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (cancelled) return;

        if (!res.ok) {
          setError(
            'Failed to adopt support session. The code may have expired or already been used.',
          );
          setLoading(false);
          return;
        }

        router.push('/');
      } catch {
        if (cancelled) return;
        setError(
          'Failed to adopt support session. The code may have expired or already been used.',
        );
        setLoading(false);
      }
    }

    exchange();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-muted-foreground">
        <div className="h-8 w-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        <span>Adopting support session…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
      <h1 className="text-2xl font-bold text-destructive">
        Support Session Error
      </h1>
      <p className="text-muted-foreground max-w-md leading-relaxed">{error}</p>
      <Link
        href="/login"
        className="text-primary hover:underline font-medium text-sm"
      >
        Return to login
      </Link>
    </div>
  );
}
