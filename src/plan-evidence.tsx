import { useEffect, useState } from 'react';
import type { CheckResult, ExecutionView, Option, PlanPartView, PlanView, RouteView } from './api/types.generated';
import { Source, Status } from './components';
import { tx } from './tx';
export const usd = (value: number) => `${value.toLocaleString('en-US')} USD`;
const planSource = (caseId: string, field: string) => `api:/cases/${encodeURIComponent(caseId)}/plan/${field}`;
const routeSource = (caseId: string, partId: string, field: string) => `api:/cases/${encodeURIComponent(caseId)}/route/parts/${encodeURIComponent(partId)}/${field}`;
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const blockedBy = (checks: CheckResult[], optionId: string) => checks.filter(check => check.optionId === optionId && check.blocking && !check.passed);
export function partOptions(plan: PlanView, part: PlanPartView) { return plan.plan.options.filter(option => part.options.includes(option.id)); }
export function partState(part: PlanPartView) {
  if (part.tier === 1) return tx('executes without approval');
  if (part.tier === 3) return tx('escalated');
  if (part.decision) return label(part.decision);
  return part.expired ? tx('deadline passed') : tx('awaiting approval');
}
/** BR-23, FR-RTE-07: time left until the approval deadline, refreshed every 30 s. */
export function TimeLeft({ part }: { part: PlanPartView }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  if (part.expired) return <strong className="time-left late">{tx('Deadline passed; moved to the backup approver')}</strong>;
  if (!part.deadlineAt) return <span className="muted">{tx('No deadline returned by server')}</span>;
  const left = Date.parse(part.deadlineAt) - now;
  if (left <= 0) return <strong className="time-left late">{tx('Deadline passed; re-verification required')}</strong>;
  return <time className="time-left" dateTime={part.deadlineAt}>{Math.floor(left / 3_600_000)} h {Math.floor(left % 3_600_000 / 60_000)} min left</time>;
}
function CheckList({ checks }: { checks: CheckResult[] }) {
  return <ul className="check-list">{checks.map((check, index) => <li key={`${check.checkId}-${index}`} className={check.passed ? 'pass' : check.blocking ? 'fail' : 'flag'}><strong>{check.checkId}</strong><span className="check-state">{check.passed ? tx('Pass') : check.blocking ? tx('Blocked') : tx('Flagged')}</span><span>{check.detail}</span></li>)}</ul>;
}
function OptionCard({ option, plan }: { option: Option; plan: PlanView }) {
  const checks = (plan.checks ?? []).filter(check => check.optionId === option.id);
  const blocked = blockedBy(plan.checks ?? [], option.id);
  return <article className={`option-card${blocked.length ? ' blocked' : ''}`}>
    <div className="panel-top"><h3>{option.id} · {option.name}</h3><span className={`badge ${blocked.length ? 'red' : plan.plan.chosen.includes(option.id) ? 'green' : 'blue'}`}><i/>{blocked.length ? `Blocked · ${blocked.map(check => check.checkId).join(', ')}` : plan.plan.chosen.includes(option.id) ? tx('Chosen') : tx('Viable')}</span></div>
    <dl className="details"><div><dt>{tx('Coverage')}</dt><dd>{option.coverageUnits} {tx('units')}</dd></div><div><dt>{tx('Cost')}</dt><dd><Source sourceRef={option.costSourceRef}>{usd(option.costUsd)}</Source></dd></div><div><dt>{tx('Arrival')}</dt><dd><time dateTime={option.arrival}>{option.arrival}</time></dd></div>{option.actions.map((action, index) => <div key={index}><dt>{tx('Action')}</dt><dd>{label(action.type)}</dd></div>)}</dl>
    {option.figures?.length ? <dl className="details">{option.figures.map((figure, index) => <div key={`${figure.name}-${index}`}><dt>{figure.name}</dt><dd><Source sourceRef={figure.sourceRef}>{String(figure.value)} {figure.unit ?? ''}</Source></dd></div>)}</dl> : null}
    <p className="fine-print">{option.rationale}</p>
    {checks.length ? <CheckList checks={checks}/> : <p className="muted">{tx('No checks recorded for this option')}</p>}
  </article>;
}
/** FR-UI-07: option cards with check lists; blocked cards say which check failed and why. */
export function PlanOptions({ caseId, plan }: { caseId: string; plan: PlanView }) {
  const planChecks = (plan.checks ?? []).filter(check => check.optionId == null);
  return <>
    <article className="panel recommendation"><h3>{tx('Chosen plan')}: {plan.plan.chosen.join(' + ')}</h3>
      <dl className="details"><div><dt>{tx('Total cost')}</dt><dd><Source sourceRef={planSource(caseId, 'totalCostUsd')}>{usd(plan.plan.totalCostUsd)}</Source></dd></div><div><dt>{tx('Coverage')}</dt><dd>{plan.plan.coverageUnits} {tx('units')}</dd></div><div><dt>{tx('Plan confidence (BR-18)')}</dt><dd>{plan.confidence == null ? tx('Not verified yet') : <Source sourceRef={planSource(caseId, 'confidence')}>{String(plan.confidence)}</Source>}</dd></div><div><dt>{tx('Automated Reasoning')}</dt><dd>{plan.automatedReasoning ? <Status value={plan.automatedReasoning.status}/> : tx('Not returned by server')}</dd></div></dl>
      <p className="fine-print">{plan.plan.rationale}</p>
      {planChecks.length ? <CheckList checks={planChecks}/> : null}
    </article>
    <div className="option-grid">{plan.plan.options.map(option => <OptionCard key={option.id} option={option} plan={plan}/>)}</div>
  </>;
}
/** FR-RTE-02/07/08: one plan part with cost, checks, sources, undo summary and time left. */
export function PartEvidence({ caseId, plan, part }: { caseId: string; plan: PlanView; part: PlanPartView }) {
  const options = partOptions(plan, part);
  const blocked = options.flatMap(option => blockedBy(plan.checks ?? [], option.id));
  const costRef = options.length === 1 ? options[0].costSourceRef : routeSource(caseId, part.planPartId, 'costUsd');
  return <article className="panel plan-part">
    <div className="panel-top"><h3>{tx('Tier')} {part.tier} · {partState(part)}</h3><span className="muted">{tx('Options')} {part.options.join(' + ')}</span></div>
    <dl className="details">
      <div><dt>{tx('Cost')}</dt><dd><Source sourceRef={costRef}>{usd(part.costUsd)}</Source></dd></div>
      <div><dt>{tx('Checks')}</dt><dd>{blocked.length ? `${tx('Blocked by')} ${blocked.map(check => check.checkId).join(', ')}` : tx('No blocking check failed on this part')}</dd></div>
      {part.tier === 2 && <><div><dt>{tx('Assigned approver')}</dt><dd>{part.approverId ?? tx('None available')}</dd></div><div><dt>{tx('Backup approver')}</dt><dd>{part.backupApproverId ?? tx('None available')}</dd></div><div><dt>{tx('Time left')}</dt><dd>{part.decision ? tx('Decided') : <TimeLeft part={part}/>}</dd></div></>}
      {part.decision && <><div><dt>{tx('Decision')}</dt><dd><Status value={part.decision}/>{part.decidedAt && <small> · {part.decidedAt}</small>}</dd></div>{part.comment ? <div><dt>{tx('Comment')}</dt><dd>{part.comment}</dd></div> : null}</>}
    </dl>
    <h4>{tx('Sources')}</h4>
    <ul className="source-list">{options.flatMap(option => (option.figures ?? []).map((figure, index) => <li key={`${option.id}-${figure.name}-${index}`}>{figure.name}: <Source sourceRef={figure.sourceRef}>{String(figure.value)} {figure.unit ?? ''}</Source></li>))}</ul>
    <h4>{tx('Undo plan summary')}</h4>
    <UndoSummary part={part}/>
  </article>;
}
export function UndoSummary({ part }: { part: PlanPartView }) {
  return <ul className="undo-list">{(part.undoSummary ?? []).map((step, index) => <li key={`${step.optionId}-${index}`} className={step.reversible ? 'pass' : 'flag'}><strong>{step.optionId} · {label(step.actionType)}</strong><span>{step.undo}</span></li>)}</ul>;
}
/** FR-UI-10: workflow steps with SAP document numbers, undo and milestones, as recorded. */
export function ExecutionList({ route, execution }: { route: RouteView; execution: ExecutionView[] }) {
  return <>{execution.map(run => {
    const part = route.parts?.find(item => item.planPartId === run.planPartId);
    return <article key={run.planPartId} className="panel"><div className="panel-top"><h3>{tx('Plan part')} {part?.options.join(' + ') ?? run.planPartId}</h3><Status value={run.status}/></div>
      <ol className="workflow-list">{(run.steps ?? []).map(step => <li key={`${step.index}-${step.target}`}><span className="workflow-number">{step.index + 1}</span><div><strong>{label(step.actionType)}</strong><p className="fine-print">{step.target}</p>{step.sapDocument ? <p>{tx('SAP document')}: {step.sourceRef ? <Source sourceRef={step.sourceRef}>{step.sapDocument}</Source> : <>{step.sapDocument} <small>{tx('(source not returned)')}</small></>}</p> : null}{step.undoType && <p className="fine-print">{`Undo: ${step.undoType}`}</p>}{step.irreversible && <p className="fine-print">{tx('Not reversible')}</p>}</div><Status value={step.status ?? 'NOT_STARTED'}/></li>)}</ol>
      {run.milestones?.length ? <ol className="milestone-list">{run.milestones.map((milestone, index) => <li key={`${milestone.type}-${index}`}><span>{label(milestone.type)}</span> <time dateTime={milestone.ts}>{milestone.ts}</time></li>)}</ol> : null}
    </article>;
  })}</>;
}
