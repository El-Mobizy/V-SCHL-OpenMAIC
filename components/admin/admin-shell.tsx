'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut, Sun, Moon, Monitor, Menu, X } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useBranding } from '@/lib/hooks/use-branding';
import { useTheme } from '@/lib/hooks/use-theme';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';
import { SiteFooter } from '@/components/site-footer';

const THEME_CYCLE = ['light', 'dark', 'system'] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { logoUrl, schoolName } = useBranding();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };
  const cycleTheme = () => {
    const i = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(i + 1) % THEME_CYCLE.length]);
  };
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-sidebar-border">
        <img src={logoUrl} alt={schoolName} className="h-8 shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col">
          <span
            className="text-base font-semibold text-foreground leading-tight truncate"
            title={schoolName}
          >
            {schoolName}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
            Admin
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden -mr-2"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Sidebar />
      </div>
      <div className="border-t border-sidebar-border p-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground truncate">{user?.name}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}. Click to change.`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-t-2 border-t-primary bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <img src={logoUrl} alt={schoolName} className="h-7" />
        <span className="text-sm font-semibold text-foreground truncate">{schoolName}</span>
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-primary">
          Admin
        </span>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground flex-col border-t-2 border-t-primary border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 transition-opacity',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            'absolute inset-y-0 left-0 w-64 max-w-[80vw] bg-sidebar text-sidebar-foreground border-r flex flex-col shadow-xl transition-transform duration-200 border-t-2 border-t-primary border-sidebar-border',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebarContent}
        </aside>
      </div>

      <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
