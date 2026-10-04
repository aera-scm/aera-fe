import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortfolioPanel } from './portfolio';
import './i18n';

const auth = vi.hoisted(() => {
  vi.stubEnv('VITE_DATA_MODE', 'live');
  vi.stubEnv('VITE_API_URL', 'https://api.example.test');
  return { session: vi.fn(async () => ({ tokens: { idToken: { toString: () => 'token' } } })) };
});
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: auth.session }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = () => render(<QueryClientProvider client={new QueryClient()}><PortfolioPanel caseId="EXC-2026-0919"/></QueryClientProvider>);

it('FR-OPZ-04 shows each case\'s allocation, what it gave up and the sourced saving', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    portfolioId: 'PF-1', caseIds: ['EXC-2026-0919', 'EXC-2026-0920'], solverStatus: 'OPTIMAL',
    objective: 1000, singleObjective: 2500, savingVsSingle: 1500,
    candidateActions: [{ id: 'EXC-2026-0919/A', caseId: 'EXC-2026-0919' }, { id: 'EXC-2026-0919/C', caseId: 'EXC-2026-0919' }, { id: 'EXC-2026-0920/C', caseId: 'EXC-2026-0920' }],
    allocations: [{ candidateId: 'EXC-2026-0919/A', caseId: 'EXC-2026-0919', quantity: 640 }, { candidateId: 'EXC-2026-0920/C', caseId: 'EXC-2026-0920', quantity: 600 }],
    uncovered: [{ needId: 'EXC-2026-0919/1000101', quantity: 600 }],
    capacities: [{ resource: 'DONOR#MAT-48219#1020', quantity: 600, sourceRef: 'SAP:stock/1020' }],
    excluded: [],
  }))));
  mount();
  expect(await screen.findByRole('heading', { name: 'Portfolio allocation' })).toBeVisible();
  expect(screen.getByText('1,500 USD').closest('[data-source-ref]')).toHaveAttribute('data-source-ref', 'optimizer:PF-1/savingVsSingle');
  expect(screen.getByText('A: 640 PC')).toBeVisible();
  expect(screen.getByText('Option C')).toBeVisible();
  expect(screen.getByText('600 PC uncovered')).toBeVisible();
  expect(screen.getByText('600 PC').closest('[data-source-ref]')).toHaveAttribute('data-source-ref', 'SAP:stock/1020');
});

it('FR-OPZ-01 a case without competitor shows no portfolio panel', async () => {
  const fetch = vi.fn(async () => new Response('{}', { status: 404 }));
  vi.stubGlobal('fetch', fetch);
  const { container } = mount();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(container).toBeEmptyDOMElement();
});
