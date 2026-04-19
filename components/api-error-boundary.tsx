// components/api-error-boundary.tsx
'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/lib/store/auth';

export function ApiErrorBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onReject(e: PromiseRejectionEvent) {
      const err = e.reason;
      if (!(err instanceof ApiError)) return;
      e.preventDefault();

      switch (err.code) {
        case 'UNAUTHORIZED':
          useAuthStore.getState().logout().finally(() => router.push('/login'));
          break;
        case 'SUSPENDED':
          toast.error('Account suspended, contact admin');
          useAuthStore.getState().logout().finally(() => router.push('/login'));
          break;
        case 'FORBIDDEN':
          toast.error("You don't have permission for that");
          break;
        case 'RATE_LIMITED':
          toast.error(err.retryAfter ? `Try again in ${err.retryAfter}s` : 'Rate limited');
          break;
        case 'PAYLOAD_TOO_LARGE':
          toast.error('Too large (5 MB max)');
          break;
        case 'NOT_CONFIGURED':
          toast.error(err.detail);
          break;
        case 'VALIDATION':
          toast.error(err.detail || 'Invalid input');
          break;
        case 'NOT_FOUND':
          // silent; callers opt in explicitly
          break;
        default:
          toast.error('Something went wrong. Try again.');
          console.error(err);
      }
    }
    window.addEventListener('unhandledrejection', onReject);
    return () => window.removeEventListener('unhandledrejection', onReject);
  }, [router]);

  return <>{children}</>;
}
