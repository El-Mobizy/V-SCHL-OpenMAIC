import { BulkQuotaForm } from '@/components/admin/bulk-quota-form';

export default function QuotasSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Token quotas</h1>
        <p className="text-sm text-muted-foreground">
          Roll out a new default quota across every existing student token-quota row.
        </p>
      </div>
      <BulkQuotaForm />
    </div>
  );
}
