'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { useBranding } from '@/lib/hooks/use-branding';
import { useTheme } from '@/lib/hooks/use-theme';
import { SiteFooter } from '@/components/site-footer';
import { ModelOverridePicker } from '@/components/model-override-picker';
import { TokenUsageOrb } from '@/components/token-usage-orb';

const THEME_CYCLE = ['light', 'dark', 'system'] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { logoUrl, schoolName } = useBranding();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const cycleTheme = () => {
    const i = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(i + 1) % THEME_CYCLE.length]);
  };
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between border-t-2 border-t-primary">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoUrl} alt={schoolName} className="h-8 shrink-0" />
          <span
            className="text-base font-semibold text-foreground truncate"
            title={schoolName}
          >
            {schoolName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user?.name} ({user?.role})
          </span>
          <ModelOverridePicker />
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}. Click to change.`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sign out">
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto p-6">{children}</main>
      <SiteFooter />
      {user?.role === 'student' && <TokenUsageOrb />}
    </div>
  );
}
