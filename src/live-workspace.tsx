import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowLeft, Database, ShieldCheck, Sparkles } from 'lucide-react';
import Modal from '@cloudscape-design/components/modal';
import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import { ApiError, trace, traceTitle, type Role } from './api/client';
import { caseDetail, confirmField, decideApproval, rollbackCase, startRun } from './api/case';
import type { Case, ExtractedField, Signal } from './api/types.generated';
import { Empty, Heading, Notice, Source, Status } from './components';
import { tx } from './tx';
import { ExecutionList, PartEvidence, PlanOptions, TimeLeft, UndoSummary, partCostSource, partOptions, usd } from './plan-evidence';
const stages = ['signal', 'triage', 'impact', 'options', 'approve', 'execute'];
const startable = ['TRIAGED', 'WAITING_PLANNER', 'WAITING_SUPPLIER', 'PLAN_PROPOSED', 'REJECTED', 'ESCALATED'];
type Review = { kind: 'field'; field: ExtractedField; signalId: string; updatedAt: string }
  | { kind: 'run' | 'rollback'; updatedAt: string }
  | { kind: 'approval'; decision: 'APPROVED' | 'REJECTED'; planVersionHash: string; planPartId: string; updatedAt: string };
const caseSource = (caseId: string, field: string) => `api:/cases/${encodeURIComponent(caseId)}/case/${field}`;
const signalSource = (caseId: string, signalId: string, field: string) => `api:/cases/${encodeURIComponent(caseId)}/signals/${encodeURIComponent(signalId)}/${field}`;
export function LiveWorkspace({ role, ask, connected, approvalOnly = false }: { role: Role; ask: () => void; connected: boolean; approvalOnly?: boolean }) {
  const { id = '', stage: routeStage } = useParams();
  const { t } = useTranslation();
  const stage = approvalOnly ? 'approve' : routeStage ?? 'signal';
  const queryClient = useQueryClient();
  const [review, setReview] = useState<Review | null>(null);
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState('');
  const [accepted, setAccepted] = useState<'run' | 'rollback' | 'approval' | null>(null);
  const submitting = useRef(false);
  const validRoute = /^EXC-\d{4}-\d{4,}$/.test(id) && stages.includes(stage);
  const detail = useQuery({ queryKey: ['case', id], queryFn: ({ signal }) => caseDetail(id, signal), enabled: validRoute, refetchInterval: connected ? false : 2000 });
  const events = useQuery({ queryKey: ['trace', id], queryFn: ({ signal }) => trace(id, signal), enabled: validRoute, refetchInterval: connected ? false : 2000 });
  const row = detail.data?.case;
  const planner = role === 'planner' || role === 'admin';
  const fresh = Boolean(row) && !detail.isFetching && !detail.isError;
  const canRun = fresh && planner && startable.includes(row!.status) && !row!.activeRunId && accepted !== 'run';
  const canRollback = fresh && role === 'approver' && row!.status === 'REOPENED' && accepted !== 'rollback';
  const plan = detail.data?.plan ?? null;
  const route = detail.data?.route ?? null;
  // FR-RTE-07: only an undecided Tier 2 part before its deadline can be decided; the server re-checks everything.
  const pending = route?.tier === 2 ? route.parts?.find(part => part.tier === 2 && !part.decision) : undefined;
  const open = Boolean(pending) && !pending!.expired && (!pending!.deadlineAt || Date.parse(pending!.deadlineAt) > Date.now());
  const canDecide = fresh && role === 'approver' && open && accepted !== 'approval';
  const latestSignal = review?.kind === 'field' ? detail.data?.signals.find(signal => signal.signalId === review.signalId) : undefined;
  const latestField = review?.kind === 'field' ? latestSignal?.fields?.find(field => field.fieldId === review.field.fieldId) : undefined;
  const canConfirm = fresh && row?.updatedAt === review?.updatedAt && (review?.kind === 'field'
    ? planner && latestSignal?.senderVerified === true && latestSignal.status !== 'QUARANTINED' && latestSignal.guardrailResult !== 'BLOCKED' && latestField?.status === 'UNCONFIRMED' && latestField.value === review.field.value && Boolean(value.trim())
    : review?.kind === 'approval' ? canDecide && route?.planVersionHash === review.planVersionHash && pending?.planPartId === review.planPartId && (review.decision === 'APPROVED' || Boolean(value.trim()))
    : review?.kind === 'run' ? canRun : review?.kind === 'rollback' && canRollback);
  async function refresh() {
    await Promise.all(['case', 'cases', 'signals', 'trace', 'dialogue'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (action: Review) => {
      if (action.kind === 'field') return confirmField(id, action.field.fieldId, value.trim());
      if (action.kind === 'approval') return decideApproval(id, { decision: action.decision, comment: value.trim(), planVersionHash: action.planVersionHash });
      if (action.kind === 'run') return startRun(id);
      return rollbackCase(id);
    },
    onSuccess: (_result, action) => {
      setReview(null); setChecked(false);
      if (action.kind !== 'field') setAccepted(action.kind);
      setNotice(action.kind === 'approval' ? tx('Decision recorded. Follow refreshed server state and trace for the outcome.') : tx('Request accepted. Follow refreshed server state and trace for the outcome.'));
    },
    onError: (error, action) => {
      setReview(null); setChecked(false);
      // AT-16: a stale decision is refused; the refreshed case shows the current plan.
      if (action.kind === 'approval' && error instanceof ApiError && error.status === 409) {
        setNotice(error.currentPlanVersionHash && error.currentPlanVersionHash !== action.planVersionHash
          ? tx('The plan changed. The current plan is shown; review it before deciding.')
          : tx('The decision was refused. The refreshed case shows the current state.'));
      }
    },
    onSettled: async () => { await refresh(); submitting.current = false; },
  });
  function openReview(action: Review) {
    if (submitting.current || mutation.isPending) return;
    mutation.reset(); setNotice(''); setChecked(false); setValue(action.kind === 'field' ? action.field.value : ''); setReview(action);
  }
  function submit() {
    if (!review || !checked || !canConfirm || submitting.current || mutation.isPending) return;
    submitting.current = true;
    mutation.mutate(review);
  }
  if (!validRoute) return <Empty title={tx('Case or stage not found')}><Link to="/board">{tx('Return to overview')}</Link></Empty>;
  return <div className="live-workspace">
    <Link className="back-link" to={approvalOnly ? '/approvals' : '/board'}><ArrowLeft size={15}/>{approvalOnly ? tx('All approvals') : tx('Back to overview')}</Link>
    {detail.isPending && <p role="status">{tx('Loading case evidence')}</p>}
    {detail.isError && <div className="panel"><p role="alert">{detail.error.message}</p><button className="secondary" disabled={detail.isFetching} onClick={() => { void detail.refetch(); }}>{tx('Refresh case')}</button></div>}
    {row && <>
      <Heading eyebrow={`${row.caseId} · ${row.material}`} title={row.materialDescription ?? row.material}><button className="secondary" onClick={ask}><Sparkles size={16}/>{t('ask')}</button></Heading>
      <div className="case-meta"><Status value={row.status}/><Source sourceRef={caseSource(id, 'plant')}>{tx('Plant')} {row.plant}</Source>{row.poNumber && <Source sourceRef={caseSource(id, 'poNumber')}>{tx('PO')} {row.poNumber}</Source>}<span className="muted">{tx('Server stage')}: {t(row.stage.toLowerCase())}</span><button className="secondary" disabled={detail.isFetching || mutation.isPending} onClick={() => { void refresh(); }}>{tx('Refresh case')}</button></div>
      <div className="workspace-layout">
        <nav className="stage-rail" aria-label={tx('Case stages')}>{stages.map((item, index) => <Link key={item} to={approvalOnly && item === 'approve' ? `/approvals/${id}` : `/cases/${id}/${item}`} className={`stage-link ${stage === item ? 'current' : ''}`} aria-current={stage === item ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span><div>{t(item)}</div></Link>)}</nav>
        <div className="workspace-content">
          {notice && <Notice>{notice}</Notice>}
          {mutation.isError && <p role="alert">{mutation.error.message}</p>}
          {stage === 'signal' && <><div className="section-title"><h2>{tx('Original signals and extracted fields')}</h2><p>{tx('Supplier content is evidence, not permission to act. Review before confirming.')}</p></div>{detail.data!.signals.length ? detail.data!.signals.map(signal => <SignalCard key={signal.signalId} signal={signal} caseId={id} disabled={!fresh || !planner || mutation.isPending} review={field => openReview({ kind: 'field', field, signalId: signal.signalId, updatedAt: row.updatedAt })}/>) : <Empty title={tx('No linked signals returned')}>{tx('No supplier evidence is substituted from the demo.')}</Empty>}</>}
          {(stage === 'triage' || stage === 'impact') && <><article className="panel"><h2>{stage === 'triage' ? tx('Stored triage assessment') : tx('Source-backed impact')}</h2><p className="fine-print">{tx('Case values below are stored server results. Evidence figures retain their original source references.')}</p><dl className="details">{[['Revenue at risk', 'rarUsd', row.rarUsd, 'USD'], ['Priority score', 'priorityScore', row.priorityScore, ''], ['Stock-out at', 'stockoutAt', row.stockoutAt, ''], ['Days late', 'daysLate', row.daysLate, 'days']].map(([label, field, figure, unit]) => <div key={String(field)}><dt>{tx(String(label))}</dt><dd>{figure == null ? tx('Not returned by server') : <Source sourceRef={caseSource(id, String(field))}>{String(figure)} {unit}</Source>}</dd></div>)}</dl></article><EvidenceFigures row={row}/></>}
          {stage === 'options' && <><div className="section-title"><h2>{tx('Resolution options')}</h2><p>{tx('Options, checks and confidence are the stored Verifier results for the current plan version.')}</p></div>{plan ? <PlanOptions caseId={id} plan={plan}/> : <article className="panel"><Status value={row.status}/><p>{tx('No plan is recorded for the current plan version.')}</p><EvidenceFigures row={row}/></article>}</>}
          {stage === 'approve' && (plan && route ? <><article className="panel approval-summary"><div className="panel-top"><h2>{tx('Approval')}</h2><Status value={row.status}/></div>
            <dl className="details"><div><dt>{tx('Chosen plan')}</dt><dd>{plan.plan.chosen.join(' + ')}</dd></div><div><dt>{tx('Total cost')}</dt><dd><Source sourceRef={`api:/cases/${encodeURIComponent(id)}/plan/totalCostUsd`}>{usd(plan.plan.totalCostUsd)}</Source></dd></div><div><dt>{tx('Revenue at risk')}</dt><dd>{row.rarUsd == null ? tx('Not returned by server') : <Source sourceRef={caseSource(id, 'rarUsd')}>{usd(row.rarUsd)}</Source>}</dd></div><div><dt>{tx('Plan confidence (BR-18)')}</dt><dd>{plan.confidence == null ? tx('Not verified yet') : <Source sourceRef={`api:/cases/${encodeURIComponent(id)}/plan/confidence`}>{String(plan.confidence)}</Source>}</dd></div><div><dt>{tx('Route')}</dt><dd>{tx('Tier')} {route.tier}{route.reason ? ` · ${route.reason}` : ''}</dd></div></dl>
            {route.tier === 2 && <div className="approval-actions"><button className="secondary danger" disabled={!canDecide || mutation.isPending} onClick={() => openReview({ kind: 'approval', decision: 'REJECTED', planVersionHash: route.planVersionHash, planPartId: pending!.planPartId, updatedAt: row.updatedAt })}>{tx('Reject plan')}</button><button className="primary" disabled={!canDecide || mutation.isPending} onClick={() => openReview({ kind: 'approval', decision: 'APPROVED', planVersionHash: route.planVersionHash, planPartId: pending!.planPartId, updatedAt: row.updatedAt })}>{tx('Review & approve')}</button></div>}
            <p className="fine-print">{tx('Only the assigned approver within the approval limit can decide before the deadline. The server checks role, limit, deadline and plan version.')}</p></article>
            {(route.parts ?? []).map(part => <PartEvidence key={part.planPartId} caseId={id} plan={plan} part={part}/>)}</>
            : <article className="panel approval-summary"><h2>{tx('Approval')}</h2><Status value={row.status}/><p>{tx('No route is recorded for the current plan version.')}</p></article>)}
          {stage === 'execute' && <article className="panel"><h2>{tx('Execution and monitoring')}</h2><Status value={row.status}/>{route && detail.data!.execution.length ? <ExecutionList route={route} execution={detail.data!.execution}/> : <p>{tx('No execution records for the current plan version. No workflow steps are inferred.')}</p>}<dl className="details"><div><dt>{tx('Active reasoning run')}</dt><dd>{row.activeRunId ? <Source sourceRef={caseSource(id, 'activeRunId')}>{row.activeRunId}</Source> : tx('No active run reported')}</dd></div></dl><button className="secondary danger" disabled={!canRollback || mutation.isPending} onClick={() => openReview({ kind: 'rollback', updatedAt: row.updatedAt })}>{tx('Review rollback request')}</button><p className="fine-print">{tx('Rollback requests require an approver and a reopened case. The server controls eligibility and the workflow outcome.')}</p></article>}
          <article className="panel"><h3>{tx('Request investigation or replanning')}</h3><p>{tx('Starts asynchronous reasoning only. This request neither approves a plan nor grants SAP write permission.')}</p><button className="secondary" disabled={!canRun || mutation.isPending} onClick={() => openReview({ kind: 'run', updatedAt: row.updatedAt })}>{tx('Review run request')}</button></article>
        </div>
        <aside className="trace-panel"><div className="panel-top"><span className="inline"><Activity size={17}/>{tx('Case trajectory')}</span><span className="badge blue">{connected ? tx('Live') : tx('Polling')}</span></div><p className="fine-print">{tx('Server-reported evidence and decisions. No inferred checks.')}</p>{events.isError && <p role="alert">{events.error.message}</p>}{events.isPending && <p role="status">{tx('Loading trajectory')}</p>}{events.data?.length ? <ol className="trace-list">{events.data.map((event, index) => <li key={event.eventId ?? `${event.ts}-${index}`} className={`trace-${event.kind.toLowerCase()}`}><span className="trace-point">{event.kind === 'GUARD' || event.kind === 'CHECK' ? <ShieldCheck size={14}/> : <Database size={14}/>}</span><span className="trace-kind">{event.kind.replaceAll('_', ' ')}</span><strong>{traceTitle(event)}</strong><p>{event.detail ?? ''}</p><time dateTime={event.ts}>{event.ts}</time></li>)}</ol> : !events.isPending && !events.isError && <p className="muted">{tx('No trajectory events yet.')}</p>}</aside>
      </div>
    </>}
    <Modal visible={Boolean(review)} onDismiss={() => { if (!mutation.isPending) setReview(null); }} header={review?.kind === 'field' ? tx('Confirm extracted field') : review?.kind === 'rollback' ? tx('Confirm rollback request') : review?.kind === 'approval' ? (review.decision === 'APPROVED' ? tx('Confirm approval') : tx('Confirm rejection')) : tx('Confirm run request')} footer={<div className="modal-buttons"><Button disabled={mutation.isPending} onClick={() => setReview(null)}>{tx('Cancel')}</Button><Button variant="primary" disabled={!checked || !canConfirm || mutation.isPending} onClick={submit}>{review?.kind === 'approval' ? (review.decision === 'APPROVED' ? tx('Approve plan part') : tx('Reject plan part')) : tx('Submit confirmed request')}</Button></div>}>
      <p>{tx('Case')}: <strong>{id}</strong></p>
      {review?.kind === 'approval' && plan && pending ? <><p>{tx('Plan part')}: <strong>{partOptions(plan, pending).map(option => `${option.id} · ${option.name}`).join(' + ')}</strong></p><dl className="details"><div><dt>{tx('Cost')}</dt><dd><Source sourceRef={partCostSource(id, plan, pending)}>{usd(pending.costUsd)}</Source></dd></div><div><dt>{tx('Revenue at risk')}</dt><dd>{row?.rarUsd == null ? tx('Not returned by server') : <Source sourceRef={caseSource(id, 'rarUsd')}>{usd(row.rarUsd)}</Source>}</dd></div><div><dt>{tx('Time left')}</dt><dd><TimeLeft part={pending}/></dd></div></dl><h4>{tx('Undo plan summary')}</h4><UndoSummary part={pending}/><label className="form-label">{review.decision === 'REJECTED' ? tx('Reason (required)') : tx('Comment (optional)')}<textarea maxLength={2000} value={value} onChange={event => setValue(event.target.value)} disabled={mutation.isPending}/></label></>
      : review?.kind === 'field' ? <><p>{tx('Check original evidence. Confirming a field may resume server reasoning; it does not approve a plan.')}</p><p><strong>{review.field.name}</strong>: <Source sourceRef={signalSource(id, review.signalId, `fields/${review.field.fieldId}/value`)}>{review.field.value}</Source></p><label className="form-label">{tx('Confirmed value')}<input aria-label={tx('Confirmed value')} value={value} onChange={event => setValue(event.target.value)} disabled={mutation.isPending}/></label></> : <p>{review?.kind === 'rollback' ? tx('This requests rollback of the executed plan on a reopened case. SAP changes may follow. The server validates eligibility and the deterministic workflow performs rollback.') : tx('This requests a new asynchronous reasoning run. Review updated evidence before making any later approval decision.')}</p>}
      <Checkbox checked={checked} disabled={mutation.isPending} onChange={({ detail: change }) => setChecked(change.checked)}>{review?.kind === 'approval' ? tx('I reviewed the plan, checks, sources and undo summary and confirm this decision.') : tx('I reviewed the current evidence and confirm this server request.')}</Checkbox>
      {review && !canConfirm && <p role="status">{tx('Refresh and review current evidence, permissions and field value before submitting.')}</p>}
    </Modal>
  </div>;
}
function SignalCard({ signal, caseId, disabled, review }: { signal: Signal; caseId: string; disabled: boolean; review: (field: ExtractedField) => void }) {
  const ref = (field: string) => signalSource(caseId, signal.signalId, field);
  const unsafe = signal.status === 'QUARANTINED' || signal.guardrailResult === 'BLOCKED' || signal.senderVerified !== true;
  return <article className="panel signal-card"><div className="panel-top"><h3>{signal.channel} · {signal.signalId}</h3>{signal.status && <Status value={signal.status}/>}</div><dl className="details"><div><dt>{tx('Sender')}</dt><dd>{signal.senderId}</dd></div><div><dt>{tx('Sender verification')}</dt><dd>{signal.senderVerified === true ? tx('Verified by server') : signal.senderVerified === false ? tx('Not verified') : tx('Not returned by server')}</dd></div><div><dt>{tx('Received')}</dt><dd><Source sourceRef={ref('receivedAt')}>{signal.receivedAt}</Source></dd></div><div><dt>{tx('Guardrail result')}</dt><dd>{signal.guardrailResult ?? tx('Not returned by server')}</dd></div></dl>{signal.quarantineReason && <p role="note">{signal.quarantineReason}</p>}{signal.normalizedText ? <blockquote>{signal.normalizedText}</blockquote> : <p className="muted">{tx('No normalized text returned')}</p>}{signal.attachments?.length ? <p className="fine-print">{tx('Attachments are recorded, but this endpoint does not provide an authenticated download. Inspect original evidence through the approved channel before confirmation.')}</p> : null}{signal.fields?.map(field => <div className="field-row" key={field.fieldId}><div><strong>{field.name}</strong><p>{tx('Extraction confidence')}: <Source sourceRef={ref(`fields/${field.fieldId}/confidence`)}>{String(field.confidence)}</Source>{field.confirmedBy && <span> · {field.confirmedBy}</span>}</p></div><Source sourceRef={ref(`fields/${field.fieldId}/value`)}>{field.value}</Source><Status value={field.status}/>{field.status === 'UNCONFIRMED' && <button className="secondary" disabled={disabled || unsafe} onClick={() => review(field)}>{tx('Review field')} {field.name}</button>}</div>)}</article>;
}
function EvidenceFigures({ row }: { row: Case }) {
  return <div className="panel"><h3>{tx('Evidence figures')}</h3>{row.figures?.length ? <dl className="details">{row.figures.map((figure, index) => <div key={`${figure.name}-${index}`}><dt>{figure.name}</dt><dd><Source sourceRef={figure.sourceRef}>{String(figure.value)} {figure.unit ?? ''}</Source>{figure.readAt && <small> · {figure.readAt}</small>}</dd></div>)}</dl> : <p className="muted">{tx('No source-referenced figures returned')}</p>}</div>;
}
