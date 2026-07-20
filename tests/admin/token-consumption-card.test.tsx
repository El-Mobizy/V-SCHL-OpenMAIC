import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenConsumptionCard } from '@/components/admin/token-consumption-card';

describe('TokenConsumptionCard', () => {
  it('renders all three period numbers', () => {
    render(<TokenConsumptionCard today={100} week={500} month={2000} />);
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2,000').length).toBeGreaterThanOrEqual(1);
  });

  it('does not throw when all values are 0 (max=0 edge case)', () => {
    expect(() => render(<TokenConsumptionCard today={0} week={0} month={0} />)).not.toThrow();
  });

  it('renders the sr-only table', () => {
    const { container } = render(<TokenConsumptionCard today={10} week={50} month={200} />);
    expect(container.querySelector('table')).toBeTruthy();
  });

  it('renders em-dash for undefined values', () => {
    render(<TokenConsumptionCard today={undefined} week={undefined} month={undefined} />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});
