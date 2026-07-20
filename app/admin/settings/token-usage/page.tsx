import { TokenUsageTable } from '@/components/admin/token-usage-table';

export default function TokenUsageSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Student token usage</h1>
        <p className="text-sm text-muted-foreground">
          Per-student token quotas and month-to-date consumption. Only students who have
          interacted with the AI integration appear here.
        </p>
      </div>
      <TokenUsageTable />
    </div>
  );
}
