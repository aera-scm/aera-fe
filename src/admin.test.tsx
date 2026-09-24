import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Admin } from './admin';

const api = vi.hoisted(() => ({
  settings: vi.fn(), setThreshold: vi.fn(), setRate: vi.fn(), setApprover: vi.fn(),
  setKillSwitch: vi.fn(), resetEnvironment: vi.fn(),
}));
vi.mock('./api/client', () => ({ demoMode: false }));
vi.mock('./api/admin', () => api);
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function mount(role: 'admin' | 'planner' = 'admin') {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={query}><Admin role={role}/></QueryClientProvider>);
}

describe('FR-UI-11 live administration', () => {
  it('keeps controls away from planners', () => {
    mount('planner');
    expect(screen.getByText('Administrator access required')).toBeVisible();
    expect(api.settings).not.toHaveBeenCalled();
  });

  it('loads seeded controls and requires typed reset confirmation', async () => {
    api.settings.mockResolvedValue({ config: { KILL_SWITCH: 'off', TIER1_MAX_USD: 25000,
      TIER1_MIN_CONFIDENCE: 0.85 }, rateCard: [{ entryId: 'RC-STO-1020-1010',
      actionType: 'STO', fixedCostUsd: 4100, unitCostUsd: 0, leadTimeHours: 5,
      validFrom: '2026-01-01', validTo: '9999-12-31' }],
    approverLimits: [{ userId: 'approver@example.com', role: 'approver', plant: '1010',
      limitUsd: 50000, validFrom: '2026-01-01', validTo: '9999-12-31' }] });
    api.resetEnvironment.mockResolvedValue({});
    mount();
    const reset = await screen.findByRole('button', { name: 'Reset environment' });
    expect(screen.getByText('RC-STO-1020-1010')).toBeVisible();
    expect(reset).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reset confirmation'), { target: { value: 'RESET dev' } });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(api.resetEnvironment).toHaveBeenCalledWith('RESET dev');
  });
});
