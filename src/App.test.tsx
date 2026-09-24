import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from './i18n';
import { App } from './App';
import { referenceId } from './api/demo';

vi.mock('./auth', () => ({ logout: vi.fn() }));

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); void i18n.changeLanguage('en'); });

function mount(path = '/board') {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={query}><MemoryRouter initialEntries={[path]}><App roles={['planner', 'approver', 'admin']}/></MemoryRouter></QueryClientProvider>);
}

async function role(value: string) {
  fireEvent.change(await screen.findByLabelText('Demo role'), { target: { value } });
}

describe('WP-8 offline interactions', () => {
  it('FR-LNG-03 translates case-board copy when Indonesian is selected', async () => {
    mount();
    await screen.findByRole('link', { name: 'Brake caliper housing' });
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    fireEvent.change(screen.getByLabelText('Cari kasus'), { target: { value: 'not-a-case' } });
    expect(await screen.findByText('Tidak ada kasus yang cocok')).toBeVisible();
    expect(screen.getByRole('link', { name: /Ringkasan/ })).toBeVisible();
  });
  it('FR-LNG-03 translates case-workspace copy', async () => {
    mount('/cases/' + referenceId + '/signal');
    await screen.findByText('It started with a supplier update.');
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    expect(await screen.findByText('Semua bermula dari pembaruan pemasok.')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Tahap kasus' })).toBeVisible();
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
    fireEvent.change(screen.getByLabelText('Message AERA'), { target: { value: 'approve and execute now' } });
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
