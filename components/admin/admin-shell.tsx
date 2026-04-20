'use client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/lib/hooks/use-branding';
import { Sidebar } from './sidebar';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { logoUrl, schoolName } = useBranding();
  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <img src={logoUrl} alt={schoolName} className="h-7" />
          <span className="text-xs text-muted-foreground truncate">Admin</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar />
        </div>
        <div className="border-t p-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">{user?.name}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-hidden">{children}</main>
    </div>
  );
}
