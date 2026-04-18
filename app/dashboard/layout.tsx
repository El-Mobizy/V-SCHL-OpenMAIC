'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useBranding } from '@/lib/hooks/use-branding';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { logoUrl } = useBranding();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Logo" className="h-8" />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {user?.name} ({user?.role})
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
