import { useQuery } from '@tanstack/react-query';
import { ApiError, demoMode, request } from './api/client';
import type { Portfolio } from './api/types.generated';
import { Source, Status } from './components';
import { usd } from './plan-evidence';
import { tx } from './tx';

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === 'string' ? value : String(value ?? ''));
const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const solved = (id: string, field: string) => `optimizer:${id}/${field}`;

async function loadPortfolio(caseId: string): Promise<Portfolio | null> {
  try {
    return await request<Portfolio>(`/cases/${encodeURIComponent(caseId)}/portfolio`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** FR-OPZ-04: per case, what the optimiser chose and what it gave up, and the saving. */
export function PortfolioPanel({ caseId }: { caseId: string }) {
  const query = useQuery({ queryKey: ['portfolio', caseId], queryFn: () => loadPortfolio(caseId), enabled: !demoMode, retry: false });
  if (demoMode || query.isLoading || query.data === null) return null;
  if (query.isError || !query.data) return <article className="panel"><h2>{tx('Portfolio')}</h2><p>{tx('The portfolio allocation could not be loaded.')}</p></article>;
  const portfolio = query.data;
  const id = portfolio.portfolioId;
  const candidates = portfolio.candidateActions as Row[];
  const allocations = (portfolio.allocations ?? []) as Row[];
  const uncovered = (portfolio.uncovered ?? []) as Row[];
  const capacities = (portfolio.capacities ?? []) as Row[];
  const excluded = (portfolio.excluded ?? []) as Row[];
  const chosen = new Set(allocations.map(a => text(a.candidateId)));
  const figures: [string, string, number | null][] = [
    ['Portfolio objective', 'objective', amount(portfolio.objective)],
    ['Each case alone, first come first served', 'singleObjective', amount(portfolio.singleObjective)],
    ['Saving of the joint allocation', 'savingVsSingle', amount(portfolio.savingVsSingle)],
  ];
  return <article className="panel portfolio-panel" aria-label={tx('Portfolio allocation')}>
    <div className="panel-top"><h2>{tx('Portfolio allocation')}</h2><Status value={portfolio.solverStatus}/></div>
    <p className="fine-print">{tx('These cases compete for the same stock or capacity. The optimiser allocated them jointly; every resulting plan is still verified and routed.')}</p>
    <dl className="details">{figures.map(([label, field, value]) => <div key={field}><dt>{tx(label)}</dt><dd>{value === null ? tx('Not available') : <Source sourceRef={solved(id, field)}>{usd(value)}</Source>}</dd></div>)}</dl>
    <table className="portfolio-table"><thead><tr><th>{tx('Case')}</th><th>{tx('Chosen')}</th><th>{tx('Given up')}</th></tr></thead><tbody>
      {portfolio.caseIds.map(member => {
        const own = (row: Row) => text(row.caseId) === member;
        const taken = allocations.filter(own);
        const dropped = candidates.filter(c => own(c) && !chosen.has(text(c.id)));
        const short = uncovered.filter(u => text(u.needId).startsWith(`${member}/`) && Number(u.quantity) > 0);
        return <tr key={member} className={member === caseId ? 'current' : undefined}>
          <th scope="row">{member}</th>
          <td>{taken.length ? taken.map(a => <div key={text(a.candidateId)}><Source sourceRef={solved(id, `allocations/${text(a.candidateId)}`)}>{text(a.candidateId).split('/')[1]}: {text(a.quantity)} PC</Source></div>) : tx('Nothing allocated')}</td>
          <td>{dropped.map(c => <div key={text(c.id)}>{tx('Option')} {text(c.id).split('/')[1]}</div>)}{short.map(u => <div key={text(u.needId)}><Source sourceRef={solved(id, `uncovered/${text(u.needId)}`)}>{text(u.quantity)} PC {tx('uncovered')}</Source></div>)}{!dropped.length && !short.length && tx('Nothing')}</td>
        </tr>;
      })}
    </tbody></table>
    <h3>{tx('Limits used')}</h3>
    <ul className="plain-list">{capacities.map(c => <li key={text(c.resource)}>{text(c.resource)}: <Source sourceRef={text(c.sourceRef)}>{text(c.quantity)} PC</Source></li>)}</ul>
    {excluded.length > 0 && <><h3>{tx('Left out (no sourced capacity)')}</h3><ul className="plain-list">{excluded.map(e => <li key={`${text(e.caseId)}/${text(e.optionId)}`}>{text(e.caseId)} {tx('option')} {text(e.optionId)}</li>)}</ul></>}
  </article>;
}
