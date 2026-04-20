'use client';
import dynamic from 'next/dynamic';

const SettingsBody = dynamic(
  () => import('@/components/settings/settings-body').then((m) => m.SettingsBody),
  {
    ssr: false,
    loading: () => <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>,
  },
);

export default function AiConfigPage() {
  return (
    <div className="rounded-lg border bg-card h-[calc(100vh-6rem)] overflow-hidden">
      <SettingsBody />
    </div>
  );
}
