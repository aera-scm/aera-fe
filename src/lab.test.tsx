import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ScenarioLab } from './lab';

const api = vi.hoisted(() => ({ labRuns: vi.fn(), labRun: vi.fn(), startLabRun: vi.fn() }));
vi.mock('./api/client', () => ({ demoMode: false }));
vi.mock('./api/lab', () => api);
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('FR-LAB-01 submits selected synthetic plant', async () => {
  api.labRuns.mockResolvedValue([]);
  api.startLabRun.mockResolvedValue({ runId: 'lab-1' });
  api.labRun.mockResolvedValue({ runId: 'lab-1', deliveryMode: 'internal-replay',
    parameters: { material: 'MAT-48219', exceptionType: 'SUPPLIER_DELAY', hostile: false },
    outcome: 'RESOLVED' });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={query}>
    <ScenarioLab role="admin"/>
  </QueryClientProvider></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Plant'), { target: { value: '1030' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run this disruption' }));
  await waitFor(() => expect(api.startLabRun).toHaveBeenCalledWith(
    expect.objectContaining({ plant: '1030' }),
  ));
});
