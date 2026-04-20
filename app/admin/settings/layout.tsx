import Link from 'next/link';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm border-b pb-2">
        <Link
          href="/admin/settings/api-keys"
          className="text-muted-foreground hover:text-foreground"
        >
          API keys
        </Link>
        <Link
          href="/admin/settings/branding"
          className="text-muted-foreground hover:text-foreground"
        >
          Branding
        </Link>
        <Link
          href="/admin/settings/ai-config"
          className="text-muted-foreground hover:text-foreground"
        >
          AI configuration
        </Link>
      </div>
      {children}
    </div>
  );
}
