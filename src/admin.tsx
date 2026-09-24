import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tx } from './tx';
import { demoMode, type Role } from './api/client';
import {
  settings, setApprover, setKillSwitch, setRate, setThreshold, resetEnvironment,
  type ApproverLimit, type RateEntry,
} from './api/admin';
import { Admin as DemoAdmin } from './pages';
import { Empty, Heading, Notice, Source } from './components';

const environment = import.meta.env.VITE_ENV_NAME ?? 'dev';

export function Admin({ role }: { role: Role }) {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetText, setResetText] = useState('');
  const query = useQuery({ queryKey: ['admin-settings'], queryFn: ({ signal }) => settings(signal),
    enabled: role === 'admin' && !demoMode });

  if (demoMode) return <DemoAdmin role={role}/>;
  if (role !== 'admin') return <Empty title={tx('Administrator access required')}>
    {tx('This page is available to the admin role.')}
  </Empty>;

  async function save(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setNotice('');
    try {
      await action();
      await query.refetch();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : tx('Change could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  if (query.isPending) return <p role="status">{tx('Loading administration settings...')}</p>;
  if (query.isError || !query.data) return <Empty title={tx('Settings unavailable')}>
    <button className="secondary" onClick={() => { void query.refetch(); }}>{tx('Try again')}</button>
  </Empty>;

  const { config, rateCard, approverLimits } = query.data;
  const killed = config.KILL_SWITCH === 'on';
  return <>
    <Heading eyebrow={tx('WORKSPACE SETTINGS')} title={tx('Your rules. Always in control.')}/>
    <p className="page-description">{tx('Every change is checked and recorded in the audit trail.')}</p>
    {notice && <Notice close={() => setNotice('')}>{notice}</Notice>}
    <article className="panel">
      <div className="panel-top"><div><h3>{tx('Advise-only mode')}</h3>
        <p className="muted">{tx('Stop new execution. Keep investigation and recommendations.')}</p>
      </div><button className={`toggle ${killed ? 'on' : ''}`} role="switch"
        aria-label={tx('Advise-only mode')} aria-checked={killed} disabled={busy}
        onClick={() => { void save(() => setKillSwitch(!killed), tx('Advise-only setting saved.')); }}>
        <span/></button></div>
    </article>
    <article className="panel"><h3>{tx('Autonomy thresholds')}</h3>
      <div className="form-grid">
        <Threshold label={tx('Tier 1 maximum (USD)')} configKey="TIER1_MAX_USD"
          value={config.TIER1_MAX_USD} busy={busy} save={save}/>
        <Threshold label={tx('Minimum confidence')} configKey="TIER1_MIN_CONFIDENCE"
          value={config.TIER1_MIN_CONFIDENCE} busy={busy} save={save}/>
      </div>
    </article>
    <article className="panel"><h3>{tx('Rate card')}</h3>
      <p className="muted">{tx('Costs and lead times used by plan checks.')}</p>
      <div className="admin-entries">{rateCard.map(entry =>
        <RateEditor key={entry.entryId} entry={entry} busy={busy} save={save}/>)}</div>
    </article>
    <article className="panel"><h3>{tx('Approver limits')}</h3>
      <div className="admin-entries">{approverLimits.map(entry =>
        <ApproverEditor key={entry.userId} entry={entry} busy={busy} save={save}/>)}</div>
    </article>
    <article className="panel"><h3>{tx('Reset environment')}</h3>
      <p className="muted">{tx('Restore Mirror seed and clear operational cases. Audit history remains.')}</p>
      <label className="form-label">{tx('Type RESET')} {environment}
        <input aria-label={tx('Reset confirmation')} value={resetText}
          onChange={event => setResetText(event.target.value)}/></label>
      <button className="secondary danger" disabled={busy || resetText !== `RESET ${environment}`}
        onClick={() => { void save(() => resetEnvironment(resetText), tx('Environment reset completed.'));
          setResetText(''); }}>{tx('Reset environment')}</button>
    </article>
  </>;
}

type Save = (action: () => Promise<unknown>, success: string) => Promise<void>;

function Threshold({ label, configKey, value, busy, save }: {
  label: string; configKey: string; value: string | number; busy: boolean; save: Save;
}) {
  const [draft, setDraft] = useState(String(value));
  const amount = Number(draft);
  const valid = Number.isFinite(amount) && amount >= 0 &&
    (configKey !== 'TIER1_MIN_CONFIDENCE' || amount <= 1);
  return <form onSubmit={event => { event.preventDefault(); if (valid) void save(
    () => setThreshold(configKey, amount), tx('Threshold saved.')); }}>
    <label className="form-label">{label}
      <input type="number" min="0" max={configKey === 'TIER1_MIN_CONFIDENCE' ? '1' : undefined}
        step={configKey === 'TIER1_MIN_CONFIDENCE' ? '0.01' : '1'} required
        value={draft} onChange={event => setDraft(event.target.value)}/>
      <Source sourceRef={`config:${configKey}`}>{String(value)}</Source>
    </label>
    <button className="secondary" disabled={busy || !valid}>{tx('Save')}</button>
  </form>;
}

function RateEditor({ entry, busy, save }: { entry: RateEntry; busy: boolean; save: Save }) {
  const [fixed, setFixed] = useState(String(entry.fixedCostUsd));
  const [unit, setUnit] = useState(String(entry.unitCostUsd));
  const [hours, setHours] = useState(String(entry.leadTimeHours));
  const numbers = [fixed, unit, hours].map(Number);
  const valid = numbers.every(number => Number.isFinite(number) && number >= 0);
  return <form className="admin-entry" onSubmit={event => { event.preventDefault(); if (valid) void save(
    () => setRate({ ...entry, fixedCostUsd: numbers[0], unitCostUsd: numbers[1],
      leadTimeHours: numbers[2] }), tx('Rate card saved.')); }}>
    <strong>{entry.actionType} <Source sourceRef={`ratecard:${entry.entryId}`}>
      {entry.entryId}</Source></strong>
    <div className="form-grid">
      <NumberField label={tx('Fixed USD')} value={fixed} change={setFixed}/>
      <NumberField label={tx('Unit USD')} value={unit} change={setUnit}/>
      <NumberField label={tx('Lead hours')} value={hours} change={setHours}/>
    </div><button className="secondary" disabled={busy || !valid}>{tx('Save rate')}</button>
  </form>;
}

function ApproverEditor({ entry, busy, save }: {
  entry: ApproverLimit; busy: boolean; save: Save;
}) {
  const [limit, setLimit] = useState(String(entry.limitUsd));
  const amount = Number(limit);
  return <form className="admin-entry" onSubmit={event => { event.preventDefault();
    if (Number.isFinite(amount) && amount >= 0) void save(
      () => setApprover({ ...entry, limitUsd: amount }), tx('Approver limit saved.')); }}>
    <strong>{entry.userId} · {entry.plant}</strong>
    <div className="form-grid"><NumberField label={tx('Limit USD')} value={limit}
      change={setLimit}/></div>
    <button className="secondary" disabled={busy || !Number.isFinite(amount) || amount < 0}>
      {tx('Save limit')}</button>
  </form>;
}

function NumberField({ label, value, change }: {
  label: string; value: string; change: (value: string) => void;
}) {
  return <label className="form-label">{label}<input type="number" min="0" step="any"
    required value={value} onChange={event => change(event.target.value)}/></label>;
}
