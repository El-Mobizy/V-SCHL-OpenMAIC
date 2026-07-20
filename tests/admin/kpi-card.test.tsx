import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/components/admin/kpi-card';
import { Users } from 'lucide-react';

describe('KpiCard', () => {
  it('formats integer value with locale', () => {
    render(<KpiCard icon={Users} label="Students" value={1234} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
  it('renders em-dash for undefined value', () => {
    render(<KpiCard icon={Users} label="Students" value={undefined} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
  it('renders zero as "0", not em-dash', () => {
    render(<KpiCard icon={Users} label="Students" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
