import { tx } from './tx';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demoMode } from './api/client';
import { projection, whatIf, type PlantProjection, type WhatIfResponse } from './api/projection';
import { Notice, Source } from './components';
import './projection.css';

const hour = 3_600_000;
function shortTime(at: number, origin: number, long: boolean): string {
  const delta = (at - origin) / hour;
  return long ? `Day ${Math.round(delta / 24)}` : `+${Math.round(delta)}h`;
}
function chartRows(base: PlantProjection, revised: PlantProjection, long: boolean) {
  const count = long ? base.points.length : 73;
  return base.points.slice(0, count).map((point, i) => ({
    at: Date.parse(point.at), baseline: point.stock, projected: revised.points[i]?.stock ?? null,
  }));
}

export function ProjectionPanel({ caseId }: { caseId: string }) {
  const [option, setOption] = useState('plan');
  const [plant, setPlant] = useState('1010');
  const [long, setLong] = useState(false);
  const [quantity, setQuantity] = useState('600');
  const [donor, setDonor] = useState('1020');
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null);
  const query = useQuery({
    queryKey: ['projection', caseId, option],
    queryFn: ({ signal }) => projection(caseId, option === 'plan' ? undefined : option, signal),
  });
  const simulation = useMutation({ mutationFn: () => whatIf(caseId, 'C', { qty: Number(quantity), fromPlant: donor }) });
  const displayed = whatIfResult ?? query.data;
  const base = displayed?.baseline[plant];
  const revised = displayed?.projection[plant];
  const origin = base ? Date.parse(base.points[0].at) : 0;
  const rows = base && revised ? chartRows(base, revised, long) : [];
  const refs = [...new Set([...(base?.sourceRefs ?? []), ...(revised?.sourceRefs ?? [])])];
  const first = revised?.stockouts[0];
  return <article className="panel projection-panel" aria-label={tx("Stock projection")}>
    <div className="panel-top"><div><h3>{tx("Stock through time")}</h3><p className="muted">{tx("Compare current path with a proposed recovery. Shaded periods mark line stops.")}</p></div><span className="badge blue">{demoMode ? tx("Synthetic projection") : tx("SAP-backed projection")}</span></div>
    <div className="projection-controls">
      <label>{tx("Option")}<select aria-label={tx("Projection option")} value={option} onChange={event => { setOption(event.target.value); setPlant('1010'); setWhatIfResult(null); }}><option value="plan">{tx("Chosen plan")}</option><option value="C">{tx("Transfer C")}</option><option value="A">{tx("Air freight A")}</option></select></label>
      <label>{tx("Plant")}<select aria-label={tx("Projection plant")} value={plant} onChange={event => setPlant(event.target.value)}>{Object.keys(displayed?.projection ?? { '1010': true }).map(id => <option key={id} value={id}>{tx("Plant")} {id}</option>)}</select></label>
      <div className="projection-range" role="group" aria-label={tx("Projection range")}><button className={!long ? 'selected' : ''} onClick={() => setLong(false)}>{tx("72 hours")}</button><button className={long ? 'selected' : ''} onClick={() => setLong(true)}>{tx("30 days")}</button></div>
    </div>
    {query.isPending && <p role="status">{tx("Calculating projection...")}</p>}
    {query.isError && <p role="alert">{query.error.message}</p>}
    {base && revised && <>
      <div className="projection-chart" role="img" aria-label={`Stock projection for plant ${plant}. ${first ? `First stock-out ${new Date(first).toLocaleString()}.` : tx("No stock-out in 30 days.")}`}>
        <ResponsiveContainer width="100%" height={270}><ComposedChart data={rows} margin={{ top: 12, right: 18, bottom: 6, left: 2 }}>
          <CartesianGrid stroke="#e4eaf2" strokeDasharray="3 5"/><XAxis dataKey="at" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => shortTime(Number(value), origin, long)} tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }} width={42}/>
          <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="projection-tooltip"><strong>{new Date(Number(label)).toLocaleString()}</strong>{payload.map(item => <div key={String(item.dataKey)}><span>{item.dataKey === 'projected' ? 'With option' : 'Baseline'}{tx(":")} {Math.round(Number(item.value))} {tx("units")}</span><small>{tx("Sources:")} {(item.dataKey === 'projected' ? revised.sourceRefs : base.sourceRefs).join(' | ')}</small></div>)}</div> : null}/>
          {revised.lineStops.map((window, i) => <ReferenceArea key={`${window.start}-${i}`} x1={Date.parse(window.start)} x2={window.end ? Date.parse(window.end) : rows.at(-1)?.at} fill="#eeb987" fillOpacity={0.14} strokeOpacity={0}/>)}
          {first && <ReferenceLine x={Date.parse(first)} stroke="#c77454" strokeDasharray="5 4"/>}
          <Line dataKey="baseline" type="linear" stroke="#9cabc0" strokeWidth={2} dot={false} isAnimationActive={false}/><Line dataKey="projected" type="linear" stroke="#286ed1" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
        </ComposedChart></ResponsiveContainer>
      </div>
      <div className="projection-legend"><span><i className="baseline-line"/> {tx("Baseline")}</span><span><i className="projected-line"/> {tx("With option")}</span><span><i className="stop-swatch"/> {tx("Line stop")}</span></div>
      <div className="projection-facts"><span>{tx("First stock-out")} <Source sourceRef={refs.join(' | ')}>{first ? new Date(first).toLocaleString() : tx("None in 30 days")}</Source></span><span>{tx("Line-stop windows")} <Source sourceRef={refs.join(' | ')}>{revised.lineStops.length}</Source></span><span>{tx("Orders affected")} <Source sourceRef={refs.join(' | ')}>{[...new Set(revised.lineStops.flatMap(window => window.ordersAffected))].join(', ') || 'None'}</Source></span></div>
    </>}
    <div className="whatif-editor"><div><h4>{tx("Try another transfer")}</h4><p>{tx("Change quantity or donor plant. This recalculates checks and projection; plan of record stays intact.")}</p></div><label>{tx("Quantity")}<input aria-label={tx("What-if quantity")} type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)}/></label><label>{tx("Donor plant")}<input aria-label={tx("What-if donor plant")} value={donor} onChange={event => setDonor(event.target.value)} maxLength={10}/></label><button className="secondary" disabled={simulation.isPending || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 || !donor.trim()} onClick={() => { simulation.mutate(undefined, { onSuccess: result => { setWhatIfResult(result); setPlant('1010'); }, onError: () => setWhatIfResult(null) }); }}>{tx("Run what-if")}</button></div>
    {simulation.isError && <p role="alert">{simulation.error.message}</p>}
    {whatIfResult && <div className="whatif-result"><Notice>{tx("What-if only. Plan version")} {whatIfResult.planOfRecord.version} {tx("remains unchanged.")}</Notice>{whatIfResult.checks.length ? <ul>{whatIfResult.checks.map(check => <li key={check.checkId}><strong>{check.checkId}</strong> {check.passed ? tx("Pass") : tx("Blocked")} {tx("-")} {check.detail}</li>)}</ul> : <p className="fine-print">{tx("Synthetic projection only. Verifier checks require a connected workspace.")}</p>}</div>}
    {refs.length > 0 && <p className="fine-print">{tx("Projection sources:")} {refs.map(ref => <Source key={ref} sourceRef={ref}>{ref}</Source>)}</p>}
  </article>;
}
