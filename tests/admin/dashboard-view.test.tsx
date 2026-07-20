import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AdminStats } from '@/lib/types/school';

// Mock next/navigation used by components within DashboardView
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// Mock auth-context since AdminShell uses useAuth (not directly imported by DashboardView, but sidebar deps)
vi.mock('@/lib/contexts/auth-context', () => ({
  useAuth: () => ({ user: { name: 'Admin' }, logout: vi.fn() }),
}));

// Mock branding context
vi.mock('@/lib/hooks/use-branding', () => ({
  useBranding: () => ({ logoUrl: '/logo.png', schoolName: 'Test School' }),
}));

// Minimal mock for api calls to prevent network requests
vi.mock('@/lib/api/symfony', () => ({
  api: { admin: { stats: vi.fn() } },
}));

import { DashboardView } from '@/components/admin/dashboard-view';

const seed: AdminStats = {
  students: 1200,
  active_students: 300,
  courses: 45,
  syllabuses: 120,
  tokens_today: 5000,
  tokens_this_week: 28000,
  tokens_this_month: 95000,
};

describe('DashboardView', () => {
  afterEach(() => cleanup());
  it('renders KPI numbers from seed payload', () => {
    render(<DashboardView initial={seed} />);
    // Values may appear multiple times (KPI card + token consumption card + sr-only table)
    expect(screen.getAllByText('1,200').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('45').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('120').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('5,000').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the refresh button', () => {
    render(<DashboardView initial={seed} />);
    expect(screen.getByRole('button', { name: 'Refresh stats' })).toBeInTheDocument();
  });

  it('shows em-dashes for null initial data', () => {
    render(<DashboardView initial={null} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });
});
