'use client';

import React from 'react';
import { useSupportSession } from '@/lib/support/useSupportSession';

export function useIsWriteBlocked(): boolean {
  const { active, isReadOnly } = useSupportSession();
  return active && isReadOnly;
}

interface WriteGuardProps {
  children: React.ReactNode;
}

export function WriteGuard({ children }: WriteGuardProps) {
  const blocked = useIsWriteBlocked();

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <div
      title="Read-only support session"
      aria-label="Read-only support session"
      className="opacity-50 pointer-events-none cursor-not-allowed inline-block"
      data-testid="write-guard"
    >
      {children}
    </div>
  );
}
