'use client';
import { Users, BookOpen, FileText, Zap, Key, Image, Cpu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from './kpi-card';
import { TokenConsumptionCard } from './token-consumption-card';
import { QuickActionCard } from './quick-action-card';
import { ActivityPanel } from './activity-panel';
import { useAdminStats } from '@/lib/hooks/use-admin-stats';
import type { AdminStats } from '@/lib/types/school';

interface Props {
  initial: AdminStats | null;
}

export function DashboardView({ initial }: Props) {
  const { data, error, isLoading, refresh } = useAdminStats(initial);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold border-l-4 border-primary pl-3">
          Platform overview
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void refresh();
          }}
          disabled={isLoading}
          aria-label="Refresh stats"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && !data && (
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load platform stats</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refresh();
            }}
            aria-label="Retry loading stats"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Students"
          value={data?.students}
          sublabel={
            data?.active_students !== undefined
              ? `${new Intl.NumberFormat().format(data.active_students)} active`
              : undefined
          }
        />
        <KpiCard icon={BookOpen} label="Courses" value={data?.courses} />
        <KpiCard icon={FileText} label="Syllabuses" value={data?.syllabuses} />
        <KpiCard icon={Zap} label="Tokens Today" value={data?.tokens_today} />
      </div>

      {/* Row 2: Token Consumption */}
      <TokenConsumptionCard
        today={data?.tokens_today}
        week={data?.tokens_this_week}
        month={data?.tokens_this_month}
      />

      {/* Row 3: Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickActionCard
          href="/admin/settings/api-keys"
          icon={Key}
          title="Configure API keys"
          description="Add or update provider API keys used by the AI models."
        />
        <QuickActionCard
          href="/admin/settings/branding"
          icon={Image}
          title="Upload branding"
          description="Set your school logo, favicon, and color theme."
        />
        <QuickActionCard
          href="/admin/settings/ai-config"
          icon={Cpu}
          title="AI settings"
          description="Choose the default AI model and configure generation parameters."
        />
      </div>

      {/* Row 4: Activity Panel */}
      <ActivityPanel />
    </div>
  );
}
