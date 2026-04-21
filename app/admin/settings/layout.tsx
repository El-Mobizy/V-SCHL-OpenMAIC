'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin/settings/api-keys', label: 'API keys' },
  { href: '/admin/settings/branding', label: 'Branding' },
  { href: '/admin/settings/ai-config', label: 'AI configuration' },
  { href: '/admin/settings/quotas', label: 'Token quotas' },
  { href: '/admin/settings/token-usage', label: 'Token usage' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm border-b">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative pb-2 transition-colors',
                active
                  ? 'font-medium text-primary after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
