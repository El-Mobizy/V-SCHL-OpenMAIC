'use client';

import { useAuth } from '@/lib/contexts/auth-context';

export function useRole() {
  const { user } = useAuth();
  return {
    role: user?.role ?? null,
    isAdmin: user?.role === 'admin',
    isStudent: user?.role === 'student',
  };
}
