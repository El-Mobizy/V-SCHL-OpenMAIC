import { useEffect } from 'react';

/**
 * Installs a browser `beforeunload` handler while `when` is true. Shows the
 * native "Leave site? Changes you made may not be saved." prompt if the user
 * tries to reload, close the tab, type a new URL, or navigate backwards via
 * the browser chrome. Modern browsers ignore the returned message string —
 * they show their own wording — but the prompt itself is shown.
 *
 * This does NOT block Next.js in-app navigation (router.push / <Link>) in the
 * App Router. Guard those paths at the call site (disable buttons, wrap
 * navigation in confirm()).
 */
export function useUnloadGuard(when: boolean, message = 'Leave this page?'): void {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers read returnValue; modern ones just need preventDefault.
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when, message]);
}
