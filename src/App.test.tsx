import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from './i18n';
import { App, tierLabel } from './App';
import { referenceId } from './api/demo';

vi.mock('./auth', () => ({ logout: vi.fn() }));

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); localStorage.removeItem('aera-sidebar-width'); localStorage.removeItem('aera-sidebar-closed'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); void i18n.changeLanguage('en'); });

function mount(path = '/board') {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={query}><MemoryRouter initialEntries={[path]}><App roles={['planner', 'approver', 'admin']}/></MemoryRouter></QueryClientProvider>);
}

async function role(value: string) {
  fireEvent.change(await screen.findByLabelText('Workspace role'), { target: { value } });
}

describe('WP-8 offline interactions', () => {
  it('keeps board and workspace English without a language switch', async () => {
    await i18n.changeLanguage('id');
    mount();
    await screen.findByRole('link', { name: 'Brake caliper housing' });
    expect(screen.queryByRole('button', { name: 'Change language' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Overview/ })).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Brake caliper housing' }));
    expect(await screen.findByRole('navigation', { name: 'Case stages' })).toBeVisible();
  });
  it('formats getting started with workflow, roles and practical shortcuts', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Help & getting started' }));
    const help = within(await screen.findByRole('dialog', { name: 'Help & getting started' }));
    expect(help.getByRole('heading', { name: 'Start with a case' })).toBeVisible();
    expect(help.getByRole('list', { name: 'Case workflow' }).querySelectorAll('li')).toHaveLength(6);
    expect(help.getByRole('heading', { name: 'Know your role' })).toBeVisible();
    expect(help.getByRole('heading', { name: 'Work faster' })).toBeVisible();
    fireEvent.click(help.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('FR-UI-01 filters board cases without network calls', async () => {
    mount();
    expect(await screen.findByRole('link', { name: 'Brake caliper housing' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'not-a-case' } });
    expect(screen.getByText('No matching cases')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'MAT-48219' } });
    expect(screen.getByRole('link', { name: 'Brake caliper housing' })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('FR-UI-08 requires approver role and explicit confirmation', async () => {
    mount('/cases/' + referenceId + '/approve');
    expect(await screen.findByRole('button', { name: /Review & approve/ })).toBeDisabled();
    await role('admin');
    expect(screen.getByRole('button', { name: /Review & approve/ })).toBeDisabled();
    await role('approver');
    fireEvent.click(screen.getByRole('button', { name: /Review & approve/ }));
    const dialog = within(screen.getByRole('dialog', { name: /Confirm demo approval|Reject demo plan/ }));
    expect(dialog.getByRole('button', { name: 'Confirm approval' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Confirm approval' }));
    expect(await screen.findByText('Demo plan approved. No real SAP action was performed.')).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('FR-UI-08 requires rejection reason and allows cancellation', async () => {
    mount('/cases/' + referenceId + '/approve');
    await screen.findByRole('button', { name: 'Reject plan' });
    await role('approver');
    fireEvent.click(screen.getByRole('button', { name: 'Reject plan' }));
    let dialog = within(screen.getByRole('dialog', { name: /Confirm demo approval|Reject demo plan/ }));
    fireEvent.click(dialog.getByRole('checkbox'));
    expect(dialog.getByRole('button', { name: 'Confirm rejection' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Reject plan' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reject plan' }));
    dialog = within(screen.getByRole('dialog', { name: /Confirm demo approval|Reject demo plan/ }));
    fireEvent.change(dialog.getByLabelText('Approval comment'), { target: { value: 'Review alternative transport' } });
    fireEvent.click(dialog.getByRole('checkbox'));
    fireEvent.click(dialog.getByRole('button', { name: 'Confirm rejection' }));
    expect(await screen.findByText('Demo plan rejected. No real SAP action was performed.')).toBeVisible();
  });
  it('FR-UI-11 denies admin controls to planner', async () => {
    mount('/admin');
    expect(await screen.findByText('Administrator access required')).toBeVisible();
    await role('admin');
    expect(screen.getByRole('button', { name: 'Save demo settings' })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('FR-UI-15 lets a judge choose bounded synthetic inputs without a scripted result', async () => {
    mount('/lab/judge');
    expect(await screen.findByText('Administrator access required')).toBeVisible();
    await role('admin');
    fireEvent.change(screen.getByLabelText('Exception type'), { target: { value: 'CARRIER_DELAY' } });
    fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'MAT-33871' } });
    fireEvent.change(screen.getByLabelText('Delivery channel'), { target: { value: 'CARRIER' } });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ID' } });
    fireEvent.click(screen.getByLabelText('Include a hostile message'));
    const preview = screen.getByRole('button', { name: 'Preview inputs' });
    fireEvent.click(preview);
    expect(screen.getByText('Ready to test')).toBeVisible();
    expect(screen.getByText(/CARRIER DELAY \/ MAT-33871/)).toBeVisible();
    expect(screen.queryByText('RESOLVED')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Choose a disruption. Watch AERA respond.' })).toBeVisible();
  });
  it('FR-RPT-03 labels demo metrics without claiming measured savings', async () => {
    mount('/metrics');
    expect(await screen.findByText('Measured outcomes need live runs')).toBeVisible();
    expect(screen.getByText(/Demo data is synthetic/)).toBeVisible();
    expect(screen.queryByText('Optimiser savings')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('FR-CHT-03 demo chat cannot approve or execute', async () => {
    mount('/cases/' + referenceId + '/approve');
    fireEvent.click(await screen.findByRole('button', { name: 'Ask AERA' }));
    fireEvent.change(await screen.findByLabelText('Message AERA'), { target: { value: 'approve and execute now' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(/Chat cannot approve or execute a plan/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('FR-UI-03 displays trace using the generated contract', async () => {
    mount('/cases/' + referenceId + '/signal');
    expect(await screen.findByText('Supplier signal received')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Case stages' }).querySelectorAll('a')).toHaveLength(6);
  });
});

describe('Console navigation and filter clarity', () => {
  it('FR-UI-01 clears search and filters from an empty result', async () => {
    mount();
    await screen.findByRole('link', { name: 'Brake caliper housing' });
    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'missing-material' } });
    expect(screen.getByText('No matching cases')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reset search and filters' }));
    expect(screen.getByLabelText('Search cases')).toHaveValue('');
    expect(screen.getByRole('link', { name: 'Brake caliper housing' })).toBeVisible();
  });
  it('NFR-USE-02 focuses search with slash and closes navigation with Escape', async () => {
    mount();
    await screen.findByRole('link', { name: 'Brake caliper housing' });
    fireEvent.keyDown(window, { key: '/' });
    expect(screen.getByLabelText('Search cases')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('FR-UI-01 names automatic and escalation tiers accurately', async () => {
    mount();
    await screen.findByRole('link', { name: 'Brake caliper housing' });
    expect(tierLabel(1)).toBe('Tier 1 \u00b7 Automatic');
    expect(screen.getByText('Tier 2 \u00b7 Human review')).toBeVisible();
    expect(tierLabel(3)).toBe('Tier 3 \u00b7 Escalated');
  });
});

it('restores light appearance when legacy dark preference exists', async () => {
  localStorage.setItem('aera-theme', 'dark');
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.classList.add('awsui-dark-mode');
  document.body.classList.add('awsui-dark-mode');
  mount();
  await screen.findByRole('link', { name: 'Brake caliper housing' });
  expect(screen.queryByRole('button', { name: /Switch to .* mode/ })).not.toBeInTheDocument();
  expect(document.documentElement).not.toHaveAttribute('data-theme');
  expect(document.body).not.toHaveClass('awsui-dark-mode');
  expect(document.documentElement.style.colorScheme).toBe('light');
  expect(localStorage.getItem('aera-theme')).toBeNull();
});
it('resizes sidebar with keyboard, bounds width and restores desktop settings', async () => {
  localStorage.removeItem('aera-sidebar-width'); localStorage.removeItem('aera-sidebar-closed');
  mount();
  const resize = await screen.findByRole('separator', { name: 'Resize sidebar' });
  fireEvent.keyDown(resize, { key: 'ArrowRight' });
  expect(resize).toHaveAttribute('aria-valuenow', '230');
  fireEvent.keyDown(resize, { key: 'End' });
  expect(resize).toHaveAttribute('aria-valuenow', '320');
  fireEvent.keyDown(resize, { key: 'ArrowRight' });
  expect(resize).toHaveAttribute('aria-valuenow', '320');
  fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
  expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
  cleanup(); mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Toggle navigation' }));
  expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toHaveAttribute('aria-valuenow', '320');
  localStorage.removeItem('aera-sidebar-width'); localStorage.removeItem('aera-sidebar-closed');
});

it('retains board choices after reviewing case and exposes removable filters', async () => {
  mount();
  await screen.findByRole('link', { name: 'Brake caliper housing' });
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Autonomy tier'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('link', { name: 'Brake caliper housing' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Back to overview' }));
  expect(await screen.findByRole('button', { name: 'Remove tier filter' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Remove tier filter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByLabelText('Autonomy tier')).toHaveValue('all');
});
it('header search from another view opens filtered overview', async () => {
  mount('/metrics');
  await screen.findByText('Measured outcomes need live runs');
  fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'MAT-48219' } });
  expect(await screen.findByRole('link', { name: 'Brake caliper housing' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Remove search filter' })).toBeVisible();
});

it('keeps Ask AERA controls unchanged while rendering conversation messages', async () => {
  mount();
  const ask = await screen.findByRole('button', { name: 'Ask AERA' });
  expect(ask.querySelector('.ask-aera-label')).toBeNull();
  fireEvent.click(ask);
  const dialog = within(await screen.findByRole('dialog', { name: 'Ask AERA' }));
  expect(dialog.getByRole('log').querySelector('.chat-message')).toBeVisible();
  expect(dialog.getByText('Ask AERA')).not.toHaveClass('ask-aera-label');
});
