'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBranding } from '@/lib/hooks/use-branding';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const { login, isLoading, error, clearError } = useAuthStore();
  const { logoUrl, schoolName } = useBranding();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await login(identifier, password);

    // Check if login succeeded (store is updated synchronously after await)
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      router.push(redirect);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        {/* Logo area — will be replaced by branding context in Phase 6 */}
        <div className="text-center space-y-2">
          <img src={logoUrl} alt={schoolName} className="mx-auto h-12" />
          <p className="text-sm text-muted-foreground">Sign in to {schoolName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Input
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder="Email or Matric Number"
            aria-label="Email or Matric Number"
            value={identifier}
            onChange={(e) => { clearError(); setIdentifier(e.target.value); }}
            required
            autoFocus
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { clearError(); setPassword(e.target.value); }}
            required
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
