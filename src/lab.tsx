import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Beaker, ShieldCheck, Sparkles } from 'lucide-react';
import { demoMode, type Role } from './api/client';
import { labRun, labRuns, startLabRun, type LabParameters, type LabRun } from './api/lab';
import { Empty, Heading, Notice } from './components';
import { tx } from './tx';
import './lab.css';

const materials = [
  ['MAT-48219', 'Brake caliper housing', 1600],
  ['MAT-51002', 'Brake disc front', 800],
  ['MAT-33871', 'Wiring harness main', 300],
  ['MAT-20114', 'Seat frame rear', 400],
  ['MAT-60417', 'Fuel pump module', 250],
  ['MAT-72055', 'Door hinge set', 1500],
] as const;
const initial: LabParameters = {
  exceptionType: 'SUPPLIER_DELAY', material: 'MAT-48219', plant: '1010',
  daysLate: 3, quantityShort: 400, channel: 'EMAIL', language: 'EN', hostile: false,
};

export function ScenarioLab({ role, judge = false }: { role: Role; judge?: boolean }) {
  const [params, setParams] = useState<LabParameters>(initial);
  const [runId, setRunId] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const history = useQuery({ queryKey: ['lab-runs'], queryFn: ({ signal }) => labRuns(signal),
    enabled: role === 'admin' && !demoMode && !judge });
  const active = useQuery({ queryKey: ['lab-run', runId],
    queryFn: ({ signal }) => labRun(runId, signal), enabled: Boolean(runId) && !demoMode,
    refetchInterval: query => query.state.data?.outcome === 'IN_PROGRESS' ? 2000 : false });
  if (role !== 'admin') return <Empty title={tx('Administrator access required')}>
    {tx('The Scenario Lab is available to the admin role.')}</Empty>;

  const maximum = materials.find(row => row[0] === params.material)?.[2] ?? 1;
  const valid = Number.isInteger(params.daysLate) && params.daysLate >= 1 &&
    params.daysLate <= 7 && Number.isInteger(params.quantityShort) &&
    params.quantityShort >= 1 && params.quantityShort <= maximum;

  async function launch() {
    setError('');
    if (demoMode) { setPreview(true); return; }
    if (!valid) return;
    setBusy(true);
    try {
      const run = await startLabRun(params);
      setRunId(run.runId);
      void history.refetch();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tx('Run could not start.'));
    } finally {
      setBusy(false);
    }
  }

  return <div className={`lab ${judge ? 'lab-judge' : ''}`}>
    <div className="lab-heading"><Heading eyebrow={tx('SCENARIO LAB')}
      title={judge ? tx('Choose a disruption. Watch AERA respond.') : tx('Test a new disruption.')}/>
      {!judge && <Link className="secondary" to="/lab/judge">{tx('Open judge mode')} <ArrowRight size={16}/></Link>}
      {judge && <Link className="secondary" to="/lab">{tx('Exit judge mode')}</Link>}
    </div>
    <p className="page-description">{tx('Synthetic SAP Mirror scenario. Choose inputs; no outcome is scripted.')}</p>
    {error && <Notice close={() => setError('')}>{error}</Notice>}
    <div className="lab-layout"><section className="lab-card">
      <div className="lab-card-top"><Beaker size={22}/><span>{tx('1 / Shape the exception')}</span></div>
      <div className="lab-fields">
        <label>{tx('Exception type')}<select aria-label={tx('Exception type')} value={params.exceptionType}
          onChange={event => setParams({ ...params, exceptionType: event.target.value as LabParameters['exceptionType'] })}>
          <option value="SUPPLIER_DELAY">{tx('Supplier delay')}</option>
          <option value="QUANTITY_SHORTFALL">{tx('Material shortage')}</option>
          <option value="CARRIER_DELAY">{tx('Carrier delay')}</option>
        </select></label>
        <label>{tx('Material')}<select aria-label={tx('Material')} value={params.material}
          onChange={event => { const material = event.target.value;
            const cap = materials.find(row => row[0] === material)?.[2] ?? 1;
            setParams({ ...params, material, quantityShort: Math.min(params.quantityShort, cap) }); }}>
          {materials.map(([id, name]) => <option key={id} value={id}>{name} / {id}</option>)}
        </select></label>
        <label>{tx('Plant')}<select aria-label={tx('Plant')} value="1010" disabled>
          <option value="1010">1010 / Cikarang</option></select></label>
        <div className="lab-numbers">
          <label>{tx('Days late')}<input aria-label={tx('Days late')} type="number" min="1" max="7"
            value={params.daysLate} onChange={event => setParams({ ...params,
              daysLate: Number(event.target.value) })}/></label>
          <label>{tx('Quantity short')}<input aria-label={tx('Quantity short')} type="number"
            min="1" max={maximum} value={params.quantityShort}
            onChange={event => setParams({ ...params,
              quantityShort: Number(event.target.value) })}/></label>
        </div>
        <label>{tx('Delivery channel')}<select aria-label={tx('Delivery channel')} value={params.channel}
          onChange={event => setParams({ ...params, channel: event.target.value as LabParameters['channel'] })}>
          <option value="EMAIL">{tx('Email with PDF')}</option>
          <option value="WHATSAPP">{tx('WhatsApp photo')}</option>
          <option value="CARRIER">{tx('Carrier event')}</option>
        </select></label>
        <label>{tx('Language')}<select aria-label={tx('Language')} value={params.language}
          onChange={event => setParams({ ...params, language: event.target.value as LabParameters['language'] })}>
          <option value="EN">English</option><option value="ID">Bahasa Indonesia</option>
          <option value="DE">Deutsch</option></select></label>
        <label className="lab-check"><input type="checkbox" checked={params.hostile}
          onChange={event => setParams({ ...params, hostile: event.target.checked })}/>
          <span>{tx('Include a hostile message')}</span></label>
      </div>
      <button className="primary lab-launch" disabled={busy || !valid} onClick={() => { void launch(); }}>
        <Sparkles size={18}/>{busy ? tx('Starting...') : demoMode ? tx('Preview synthetic inputs') :
          tx('Run this disruption')}</button>
      <p className="fine-print">{demoMode ? tx('Preview only. No Mirror mutation or signal delivery.') :
        tx('Signals enter the gate by internal replay; provider delivery awaits live setup.')}</p>
    </section>
    <section className="lab-result lab-card"><div className="lab-card-top"><ShieldCheck size={22}/>
      <span>{tx('2 / Follow the outcome')}</span></div>
      {demoMode && preview ? <div className="lab-state"><span>{tx('Synthetic preview')}</span>
        <h2>{tx('Ready to test')}</h2><p>{params.exceptionType.replaceAll('_', ' ')} / {params.material}
          / {params.daysLate} {tx('days late')} / {params.quantityShort} {tx('units short')}</p>
        <p>{tx('Connected mode will mutate the Mirror and submit a gated signal.')}</p></div> :
      active.data ? <RunResult run={active.data}/> :
      <div className="lab-state"><span>{tx('Awaiting your selection')}</span>
        <h2>{tx('Real parameters. Open outcome.')}</h2>
        <p>{tx('Case progress, hostile-message result and audit timing appear here.')}</p></div>}
      {active.isError && <p role="alert">{tx('Run status unavailable. Retry from run history.')}</p>}
    </section></div>
    {!judge && !demoMode && <section className="panel lab-history"><h2>{tx('Previous synthetic runs')}</h2>
      {history.data?.length ? history.data.map(run => <button key={run.runId}
        onClick={() => setRunId(run.runId)} className="lab-history-row">
        <span>{run.parameters.material} / {run.parameters.exceptionType.replaceAll('_', ' ')}</span>
        <strong>{run.outcome}</strong></button>) : <p className="muted">
        {history.isPending ? tx('Loading runs...') : tx('No Lab runs yet.')}</p>}
    </section>}
  </div>;
}

function RunResult({ run }: { run: LabRun }) {
  return <div className="lab-state"><span>{tx('Synthetic run')} / {run.deliveryMode}</span>
    <h2>{run.outcome.replaceAll('_', ' ')}</h2>
    <p>{run.parameters.material} / {run.parameters.exceptionType.replaceAll('_', ' ')}</p>
    {run.caseId && <Link className="primary" to={`/cases/${run.caseId}/signal`}>
      {tx('Open case')} {run.caseId} <ArrowRight size={16}/></Link>}
    {run.parameters.hostile && <p>{tx('Hostile message')}: {run.hostileBlocked ?
      tx('Blocked by gate') : tx('Awaiting gate result')}</p>}
    {run.timeToVerifiedSeconds !== undefined && <p>{tx('Time to verified plan')}:
      {' '}{run.timeToVerifiedSeconds.toFixed(1)} s</p>}
  </div>;
}
