'use client';

import { useEffect, useState, useCallback } from 'react';

interface SupportSessionState {
  active: boolean;
  schoolName: string | null;
  agentId: number | null;
  scope: 'read' | 'write' | null;
  isReadOnly: boolean;
  breakGlass: boolean;
}

const EMPTY: SupportSessionState = {
  active: false,
  schoolName: null,
  agentId: null,
  scope: null,
  isReadOnly: false,
  breakGlass: false,
};

export function useSupportSession() {
  const [state, setState] = useState<SupportSessionState>(EMPTY);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/support/session');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {
      setState(EMPTY);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const exit = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setState(EMPTY);
    window.location.href = '/login';
  }, []);

  return { ...state, exit };
}
