import { tx } from './tx';
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShieldCheck, ChartNoAxesCombined, Settings2, Beaker, Search, Sparkles, CircleHelp, ArrowUpRight, ArrowRight, ChevronDown, SlidersHorizontal, Truck, Package, Clock3, RefreshCw, PanelLeftClose, PanelLeftOpen, X, LogOut, Bell, CircleCheck } from 'lucide-react';
import { cases, demoMode, type Role } from './api/client';
import type { Case } from './api/types.generated';
import { source, referenceId } from './api/demo';
import { useRealtime } from './api/realtime';
import { Brand, Source, Status, Empty, Heading } from './components';
import { logout } from './auth';

const Help = lazy(() => import('./dialogs').then(module => ({ default: module.Help })));
const Chat = lazy(() => import('./dialogs').then(module => ({ default: module.Chat })));
const Workspace = lazy(() => import('./pages').then(module => ({ default: module.Workspace })));
const Approvals = lazy(() => import('./pages').then(module => ({ default: module.Approvals })));
const Metrics = lazy(() => import('./pages').then(module => ({ default: module.Metrics })));
const Admin = lazy(() => import('./admin').then(module => ({ default: module.Admin })));
const ScenarioLab = lazy(() => import('./lab').then(module => ({ default: module.ScenarioLab })));

type BoardView = { search: string; type: string; tier: string; tab: string; sort: string };
const defaultView: BoardView = { search: '', type: 'all', tier: 'all', tab: 'all', sort: 'priority' };
function boardView(query: string): BoardView {
  const params = new URLSearchParams(query);
  const allowed = (key: string, values: string[], fallback: string) => values.includes(params.get(key) ?? '') ? params.get(key)! : fallback;
  return { search: params.get('q') ?? '', type: allowed('type', ['all', 'SUPPLIER_DELAY', 'QUANTITY_SHORTFALL', 'CARRIER_DELAY', 'MRP_EXCEPTION'], 'all'),
    tier: allowed('tier', ['all', '1', '2', '3'], 'all'), tab: allowed('tab', ['all', 'approval', 'new'], 'all'), sort: allowed('sort', ['priority', 'id'], 'priority') };
}
function boardUrl(view: BoardView): string {
  const params = new URLSearchParams();
  if (view.search) params.set('q', view.search);
  for (const key of ['type', 'tier', 'tab', 'sort'] as const) if (view[key] !== defaultView[key]) params.set(key, view[key]);
  return '/board' + (params.size ? '?' + params.toString() : '');
}
export function App({ roles }: { roles: Role[] }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { document.title = 'AERA'; }, []);
  const [view, setView] = useState(() => boardView(location.pathname === '/board' ? location.search : ''));
  const search = view.search;
  function updateView(change: Partial<BoardView>) {
    const next = { ...view, ...change };
    setView(next);
    navigate(boardUrl(next), { replace: location.pathname === '/board' });
  }
  function setSearch(value: string) { updateView({ search: value }); }
  const footer = useRef<HTMLElement>(null);
  const [footerHeight, setFooterHeight] = useState(80);
  useEffect(() => {
    const element = footer.current;
    if (!element) return;
    const measure = () => setFooterHeight(element.getBoundingClientRect().height || 80);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const mainContent = useRef<HTMLElement>(null);
  const routeContent = useRef<HTMLDivElement>(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      routeContent.current?.animate?.([{ opacity: .4, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
    }
    setMenu(false); setNotifications(false);
    if (document.activeElement !== searchInput.current) mainContent.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (location.pathname === '/board') {
      if (!location.search) navigate(boardUrl(view), { replace: true });
      else setView(boardView(location.search));
    }
  }, [location.pathname, location.search, navigate, view]);
  useEffect(() => {
    if (location.pathname === '/board' && location.search) {
      setView(current => boardUrl(current) === '/board' + location.search ? current : boardView(location.search));
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove('awsui-dark-mode');
    document.body.classList.remove('awsui-dark-mode');
    document.documentElement.style.colorScheme = 'light';
    try { localStorage.removeItem('aera-theme'); } catch { /* Browser policy may disable storage. */ }
  }, []);
  const [role, setRole] = useState<Role>(roles[0] ?? 'planner');
  const searchInput = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 640px)').matches ?? false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('aera-sidebar-width'));
      if (Number.isFinite(saved) && saved >= 180 && saved <= 320) return saved;
    } catch { /* Browser policy may disable storage. */ }
    return 220;
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('aera-sidebar-closed') !== 'true'; } catch { return true; }
  });
  const navigationOpen = mobile ? menu : sidebarOpen;
  const navigationToggle = useRef<HTMLButtonElement>(null);
  function closeNavigation() {
    setMenu(false);
    if (!mobile) setSidebarOpen(false);
    navigationToggle.current?.focus();
  }
  function resizeSidebar(width: number) { setSidebarWidth(Math.min(320, Math.max(180, width))); }
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 640px)');
    function changed(event: MediaQueryListEvent) { setMobile(event.matches); setMenu(false); }
    media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('aera-sidebar-width', String(sidebarWidth));
      localStorage.setItem('aera-sidebar-closed', String(!sidebarOpen));
    } catch { /* Keep navigation usable without storage. */ }
  }, [sidebarWidth, sidebarOpen]);
  const [help, setHelp] = useState(false);
  const [chat, setChat] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const realtimeCase = /^\/(?:cases|approvals)\/([^/]+)/.exec(location.pathname)?.[1];
  const connected = useRealtime(realtimeCase);
  const query = useQuery({ queryKey: ['cases'], queryFn: ({ signal }) => cases(signal), refetchInterval: demoMode || connected && !realtimeCase ? false : 2000 });
  const rows = (query.data ?? []).map(row => demoMode && row.caseId === referenceId && decision ? { ...row, status: decision, stage: 'EXECUTE' as const } : row);
  const pathCase = realtimeCase ?? (demoMode ? referenceId : rows[0]?.caseId);
  const canApprove = role === 'approver';
  const pendingApprovals = rows.filter(row => row.status === 'AWAITING_APPROVAL').length;
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (document.activeElement?.closest('[role="dialog"]')) return;
      if (event.key === 'Escape') {
        if (document.activeElement?.closest('#workspace-navigation')) navigationToggle.current?.focus();
        setMenu(false); setSidebarOpen(false); setNotifications(false);
      }
      const target = event.target;
      const editing = target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const input = window.matchMedia?.('(max-width: 640px)').matches
          ? document.querySelector<HTMLInputElement>('.board-search input') : searchInput.current;
        input?.focus();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return <div className={`app ${sidebarOpen ? '' : 'sidebar-closed'} ${resizing ? 'sidebar-resizing' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px`, '--footer-height': `${footerHeight}px` } as CSSProperties}><a className="skip-link" href="#content">{tx("Skip to content")}</a><header className="topbar"><button ref={navigationToggle} className="icon-button navigation-toggle" aria-label={tx("Toggle navigation")} aria-expanded={navigationOpen} title={tx(navigationOpen ? "Close sidebar" : "Open sidebar")} aria-controls="workspace-navigation" onClick={() => { if (mobile) setMenu(!menu); else setSidebarOpen(!sidebarOpen); }}>{navigationOpen ? <PanelLeftClose size={20}/> : <PanelLeftOpen size={20}/>}</button><Link to="/board" aria-label={tx("AERA home")}><Brand/></Link><span className="top-divider"/><span className="workspace-name">{tx("Meridian Motors")} <ChevronDown size={13}/></span><div className="top-search"><Search size={17}/><input ref={searchInput} aria-keyshortcuts="/" aria-label={tx("Search cases")} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)}/>{search && <button className="icon-button" aria-label={tx("Clear search")} onClick={() => setSearch('')}><X size={15}/></button>}<kbd>/</kbd></div><div className="top-actions"><button className="icon-button notification-button" aria-label={tx("Notifications")} aria-expanded={notifications} aria-controls="workspace-updates" onClick={() => setNotifications(!notifications)}><Bell size={19}/>{pendingApprovals > 0 && <i/>}</button><div className="avatar">{demoMode ? 'MP' : role.charAt(0).toUpperCase()}</div><div className="profile"><strong>{demoMode ? tx("Meridian planner") : tx("Your workspace")}</strong>{demoMode || roles.length > 1 ? <select aria-label={tx("Workspace role")} value={role} onChange={e => setRole(e.target.value as Role)}>{roles.map(r => <option key={r} value={r}>{tx(r)}</option>)}</select> : <span>{tx(role)}</span>}</div>{!demoMode && <button aria-label={tx("Sign out")} className="icon-button" onClick={() => { void logout().catch(() => window.location.reload()); }}><LogOut size={17}/></button>}</div></header>
    <aside id="workspace-navigation" className={`sidebar ${menu ? 'open' : ''}`} ref={element => { if (element) element.inert = !navigationOpen; }}><div className="sidebar-heading"><div className="sidebar-label">{tx("WORKSPACE")}</div><button className="icon-button" aria-label={tx("Close sidebar")} onClick={closeNavigation}><PanelLeftClose size={18}/></button></div><nav aria-label={tx("Main navigation")}>{[[LayoutDashboard, 'board', '/board'], [ShieldCheck, 'approvals', '/approvals'], [ChartNoAxesCombined, 'metrics', '/metrics'], [Beaker, 'lab', '/lab'], [Settings2, 'admin', '/admin']].map(([Icon, label, url]) => { const NavIcon = Icon as typeof LayoutDashboard; return <NavLink key={String(url)} to={String(url)} onClick={() => setMenu(false)} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><NavIcon size={19}/>{t(String(label))}{label === 'approvals' && pendingApprovals > 0 && <span className="nav-count">{pendingApprovals}</span>}</NavLink>; })}</nav><div className="sidebar-note"><div className="tiny-star">{tx("✦")}</div><strong>{tx("A little help.")}<br/>{tx("A clearer next step.")}</strong><p>{tx("Make sense of an exception, together.")}</p><button disabled={!pathCase} onClick={() => setChat(true)}>{t('ask')}<ArrowUpRight size={15}/></button></div><div className="sidebar-bottom"><button onClick={() => setHelp(true)}><CircleHelp size={18}/> {tx("Help & getting started")}</button><div className="connection"><span className={connected ? 'live-dot' : 'demo-dot'}/>{demoMode ? tx("Workspace ready") : connected ? tx("Live updates connected") : tx("Polling for updates")}</div><span className="version-label">{tx("AERA / A clearer way forward")}</span></div></aside>
    {mobile && menu && <button className="sidebar-backdrop" aria-label={tx("Close sidebar backdrop")} onClick={closeNavigation}/>}
    {!mobile && sidebarOpen && <div className="sidebar-resize" role="separator" aria-label={tx("Resize sidebar")} aria-orientation="vertical" aria-valuemin={180} aria-valuemax={320} aria-valuenow={sidebarWidth} aria-valuetext={`${sidebarWidth}px`} title={tx("Resize sidebar")} tabIndex={0}
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setResizing(true); event.preventDefault(); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeSidebar(event.clientX); }}
      onLostPointerCapture={() => setResizing(false)} onPointerUp={event => { setResizing(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onDoubleClick={() => setSidebarWidth(220)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        resizeSidebar(event.key === 'Home' ? 180 : event.key === 'End' ? 320 : sidebarWidth + (event.key === 'ArrowRight' ? 10 : -10));
      }}/>}
    <main ref={mainContent} id="content" className="main" tabIndex={-1}>{!demoMode && <div className="environment"><span className="environment-label"><i/>{tx("Connected workspace")}</span><span>{tx("SAP-backed operations")}</span></div>}{notifications && <div id="workspace-updates" className="notification-panel" role="region" aria-label={tx("Your updates")}><strong>{tx("Your updates")}</strong><p>{pendingApprovals > 0 ? `${pendingApprovals} ${tx('cases awaiting approval')}` : tx("You're up to date.")}</p><Link to="/approvals" onClick={() => setNotifications(false)}>{tx("Open approvals")} <ArrowRight size={14}/></Link></div>}
      {query.isError && query.data && <div className="notice" role="alert">{tx("Updates paused. Showing last loaded cases.")}<button className="secondary compact" onClick={() => { void query.refetch(); }}>{tx("Try again")}</button></div>}
      {query.isPending ? <div className="loading" role="status"><RefreshCw className="spin"/> {tx("Preparing your workspace…")}</div> : query.isError && !query.data ? <Empty title={tx("We couldn’t load your workspace")}><span role="alert">{query.error.message}</span><br/><button className="secondary" onClick={() => { void query.refetch(); }}>{tx("Try again")}</button></Empty> : <div className="route-view" ref={routeContent}><Suspense fallback={<div className="loading" role="status"><RefreshCw className="spin"/> {tx("Loading this view...")}</div>}><Routes><Route path="/" element={<Navigate to="/board" replace/>}/><Route path="/callback" element={<Navigate to="/board" replace/>}/><Route path="/board" element={<Board rows={rows} view={view} updateView={updateView} search={search} setSearch={setSearch} updatedAt={query.dataUpdatedAt} refresh={() => { void query.refetch(); }} refreshing={query.isFetching} ask={() => { if (pathCase) setChat(true); }}/>}/><Route path="/cases/:id/:stage" element={<Workspace rows={rows} role={role} decision={decision} decide={setDecision} ask={() => { if (pathCase) setChat(true); }} connected={connected}/>}/><Route path="/approvals" element={<Approvals rows={rows} canApprove={canApprove}/>}/><Route path="/approvals/:id" element={<Workspace rows={rows} role={role} decision={decision} decide={setDecision} ask={() => { if (pathCase) setChat(true); }} connected={connected} approvalOnly/>}/><Route path="/metrics" element={<Metrics rows={rows}/>}/><Route path="/lab" element={<ScenarioLab role={role}/>}/><Route path="/lab/judge" element={<ScenarioLab role={role} judge/>}/><Route path="/admin" element={<Admin role={role}/>}/><Route path="*" element={<Empty title={tx("This page isn’t here")}><Link to="/board">{tx("Return to the case board")}</Link></Empty>}/></Routes></Suspense></div>}

    </main><footer ref={footer} className="footer"><span>{tx("AERA · Autonomous Exception Resolution Agent")}</span><span>{tx("Problems move supply chains. AERA resolves them.")}</span></footer><Suspense fallback={<p role="status">{tx("Loading this view...")}</p>}>{help && <Help open close={() => setHelp(false)}/>} {chat && pathCase && <Chat key={pathCase} caseId={pathCase} close={() => setChat(false)}/>}</Suspense></div>;
}

function Board({ rows, view, updateView, search, setSearch, updatedAt, refresh, refreshing, ask }: { rows: Case[]; view: BoardView; updateView: (value: Partial<BoardView>) => void; updatedAt: number; search: string; setSearch: (value: string) => void; refresh: () => void; refreshing: boolean; ask: () => void }) {
  const { t } = useTranslation();
  const { type, tier, tab, sort } = view;
  const setType = (value: string) => updateView({ type: value });
  const setTier = (value: string) => updateView({ tier: value });
  const setTab = (value: string) => updateView({ tab: value });
  const setSort = (value: string) => updateView({ sort: value });
  const [filters, setFilters] = useState(false);
  const filtered = rows.filter(row => `${row.caseId} ${row.material} ${row.materialDescription} ${row.poNumber ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()) && (type === 'all' || row.type === type) && (tier === 'all' || String(row.tier) === tier) && (tab === 'all' || tab === 'approval' && row.status === 'AWAITING_APPROVAL' || tab === 'new' && row.status === 'RECEIVED')).sort((a, b) => sort === 'priority' ? (b.priorityScore ?? -1) - (a.priorityScore ?? -1) : a.caseId.localeCompare(b.caseId));
  const ref = demoMode ? rows.find(r => r.caseId === referenceId) : [...rows].sort((a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1))[0];
  const revenueSource = ref?.figures?.filter(figure => figure.name.startsWith('rar:') || figure.name === 'Revenue at risk').map(figure => figure.sourceRef).join(' + ');
  const stockSource = ref?.figures?.filter(figure => ['onHand', 'consumptionPerHour', 'hoursToStockout'].includes(figure.name)).map(figure => figure.sourceRef).join(' + ');
  const hoursLeft = ref?.stockoutAt ? Math.max(0, (Date.parse(ref.stockoutAt) - Date.now()) / 3600000) : null;
  function resetFilters() { updateView({ search: '', type: 'all', tier: 'all', tab: 'all' }); }
  const hasFilters = Boolean(search || type !== 'all' || tier !== 'all' || tab !== 'all');
  const typeLabels: Record<string, string> = { SUPPLIER_DELAY: 'Supplier delay', QUANTITY_SHORTFALL: 'Material shortage', CARRIER_DELAY: 'Carrier delay', MRP_EXCEPTION: 'MRP exception' };
  return <><div className="overview-kicker"><span>{tx("YOUR OPERATIONS, IN FOCUS")}</span><span className="muted">{tx("Operations overview")}</span></div><section className="hero"><div className="hero-copy"><span className="hero-eyebrow"><Sparkles size={15}/> {tx("A clearer way forward")}</span><h1>{t('title')}</h1><p>{tx("Turn supply chain surprises into confident next steps.")}<br/>{t('subtitle')}</p><div className="hero-buttons"><Link className="primary" to={ref ? `/cases/${ref.caseId}/impact` : '/approvals'}>{t('view')}<ArrowUpRight size={17}/></Link><button className="text-button" onClick={ask}>{tx("Explore with AERA")} <ArrowRight size={16}/></button></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="float-symbol package"><Package size={23}/></div><div className="float-symbol truck"><Truck size={23}/></div><img src="/brand/mascot.png" alt=""/><div className="mascot-note"><span className="check-circle"><CircleCheck size={13}/></span>{tx("Every exception. A way forward.")}</div></div></section>
      <div className="stat-grid"><Stat label={tx("Revenue at risk")} value={demoMode ? '$4.72M' : ref?.rarUsd != null ? `$${(ref.rarUsd / 1000000).toFixed(2)}M` : '-'} note={tx('Priority case exposure')} sourceRef={demoMode ? source.demand : revenueSource || `case:${ref?.caseId ?? 'unavailable'}/rarUsd`} tone="blue" icon={<ChartNoAxesCombined/>}/><Stat label={tx("Needs your attention")} value={String(rows.filter(r => r.status === 'AWAITING_APPROVAL').length)} note={tx("Awaiting an approval decision")} sourceRef="console:cases/status=AWAITING_APPROVAL" tone="violet" icon={<ShieldCheck/>}/><Stat label={tx("Time to stock-out")} value={demoMode ? '6h 12m' : hoursLeft !== null && Number.isFinite(hoursLeft) ? `${hoursLeft.toFixed(1)}h` : '-'} note={demoMode ? tx('Cikarang \u00b7 brake caliper housing') : tx('Priority case stock-out')} sourceRef={demoMode ? source.stock : stockSource || `case:${ref?.caseId ?? 'unavailable'}/stockoutAt`} tone="amber" icon={<Clock3/>}/><Stat label={tx(demoMode ? 'Signals, made simpler' : 'Cases in workspace')} value={demoMode ? '214 \u2192 6' : String(rows.length)} note={tx(demoMode ? 'Messages to actionable exceptions' : 'Source-linked operational cases')} sourceRef={demoMode ? source.seed : 'console:cases/count'} tone="cyan" icon={<Sparkles/>}/></div>
      <section className="case-section"><Heading eyebrow={tx("EXCEPTION WORKSPACE")} title={t('cases')}><div className="board-actions"><button className="secondary compact" disabled={refreshing} onClick={refresh} aria-label={tx("Refresh cases")}><RefreshCw size={15} className={refreshing ? "spin" : ""}/>{tx(refreshing ? "Refreshing..." : "Refresh")}</button><button className="secondary compact" aria-label={tx("Filters")} onClick={() => setFilters(!filters)} aria-expanded={filters} aria-controls="case-filters"><SlidersHorizontal size={15}/> {tx("Filters")}{(type !== 'all' || tier !== 'all') && <i className="filter-dot"/>}</button></div></Heading><label className="board-search"><Search size={17}/><input aria-label={tx("Search cases on mobile")} placeholder={t("search")} value={search} onChange={event => setSearch(event.target.value)}/>{search && <button aria-label={tx("Clear search")} onClick={() => setSearch('')}><X size={16}/></button>}</label><div className="table-toolbar"><div className="tabs">{[['all', t('all')], ['approval', tx("Needs approval")], ['new', tx("New signals")]].map(([id, label]) => <button key={id} className={tab === id ? 'selected' : ''} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}{id === 'all' && <Source sourceRef="console:cases/count"><span className="count">{rows.length}</span></Source>}</button>)}</div><label className="sort">{tx("Sort by")} <select aria-label={tx("Sort cases")} value={sort} onChange={e => setSort(e.target.value)}><option value="priority">{tx("Priority")}</option><option value="id">{tx("Case ID")}</option></select></label></div>{filters && <div id="case-filters" className="filter-panel"><label>{tx("Exception type")}<select aria-label={tx("Exception type")} value={type} onChange={e => setType(e.target.value)}><option value="all">{tx("All types")}</option><option value="SUPPLIER_DELAY">{tx("Supplier delay")}</option><option value="QUANTITY_SHORTFALL">{tx("Material shortage")}</option><option value="CARRIER_DELAY">{tx("Carrier delay")}</option><option value="MRP_EXCEPTION">{tx("MRP exception")}</option></select></label><label>{tx("Autonomy tier")}<select aria-label={tx("Autonomy tier")} value={tier} onChange={e => setTier(e.target.value)}><option value="all">{tx("All tiers")}</option><option value="1">{tx("Tier 1 · Auto")}</option><option value="2">{tx("Tier 2 · Approval")}</option><option value="3">{tx("Tier 3 · Escalate")}</option></select></label><button className="text-button" onClick={() => updateView({ type: 'all', tier: 'all' })}>{tx("Clear filters")}</button></div>}
      {hasFilters && <div className="active-filters" aria-label={tx("Active filters")}>
        {search && <button className="filter-chip" aria-label={tx("Remove search filter")} onClick={() => setSearch('')}>{tx("Search")}: {search}<X size={14}/></button>}
        {type !== 'all' && <button className="filter-chip" aria-label={tx("Remove exception filter")} onClick={() => setType('all')}>{tx(typeLabels[type])}<X size={14}/></button>}
        {tier !== 'all' && <button className="filter-chip" aria-label={tx("Remove tier filter")} onClick={() => setTier('all')}>{tierLabel(Number(tier))}<X size={14}/></button>}
        {tab !== 'all' && <button className="filter-chip" aria-label={tx("Remove status filter")} onClick={() => setTab('all')}>{tx(tab === 'approval' ? "Needs approval" : "New signals")}<X size={14}/></button>}
        <button className="text-button" onClick={resetFilters}>{tx("Clear all")}</button>
      </div>}
      <div className="results-summary" role="status" aria-live="polite"><span><Source sourceRef="console:filtered-cases/count">{filtered.length}</Source> {tx("of")} <Source sourceRef="console:cases/count">{rows.length}</Source> {tx("cases shown")}</span><span>{refreshing ? tx("Refreshing...") : demoMode ? tx("Workspace ready") : updatedAt ? `${tx("Updated at")} ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : tx("Awaiting updates")}</span></div>
      <div className="table-scroll"><table className="case-table"><thead><tr><th>{tx("Exception / material")}</th><th>{tx("Plant")}</th><th>{tx("Revenue at risk")}</th><th>{tx("Status")}</th><th aria-label={tx("Open case")}/></tr></thead><tbody>{filtered.map((row, i) => <tr key={row.caseId}><td><div className="case-cell"><span className={`case-icon ${i === 0 ? 'blue' : i === 1 ? 'violet' : 'cyan'}`}>{row.type === 'CARRIER_DELAY' ? <Truck size={19}/> : <Package size={19}/>}</span><div><Link className="case-title" to={`/cases/${row.caseId}/${row.stage.toLowerCase()}`}>{row.materialDescription ?? row.material}<ArrowUpRight size={13}/></Link><div className="case-sub"><Source sourceRef={demoMode ? source.seed : `case:${row.caseId}`}>{row.caseId} {tx("·")} {row.material}</Source></div></div></div></td><td><Source sourceRef={demoMode ? source.po : `case:${row.caseId}/plant`}>{row.plant}</Source><span className="cell-sub">{demoMode ? row.plant === '1010' ? 'Cikarang' : 'Karawang' : ''}</span></td><td>{row.rarUsd != null ? <Source sourceRef={row.figures?.filter(f => f.name === 'Revenue at risk' || f.name.startsWith('rar:')).map(f => f.sourceRef).join(' + ') || `case:${row.caseId}/rarUsd`}>{tx("$")}{(row.rarUsd / 1000000).toFixed(2)}{tx("M")}</Source> : <span className="muted">{tx("Awaiting analysis")}</span>}</td><td><Status value={row.status}/>{row.tier && <span className="cell-sub">{tierLabel(row.tier)}</span>}</td><td><Link className="row-link" aria-label={`Open ${row.caseId}`} to={`/cases/${row.caseId}/${row.stage.toLowerCase()}`}><ArrowRight size={18}/></Link></td></tr>)}</tbody></table>{!filtered.length && <Empty title={tx(rows.length ? "No matching cases" : "No cases yet")}>{tx(rows.length ? "Try another search or clear your filters." : "New exceptions will appear here when signals arrive.")}<br/><button className="secondary" onClick={resetFilters}>{tx("Reset search and filters")}</button></Empty>}</div><div className="table-bottom"><span role="status" aria-live="polite"><Source sourceRef="console:filtered-cases/count">{filtered.length}</Source> {tx("cases in this view")}</span><span className="inline"><ShieldCheck size={13}/>{demoMode ? tx("Evidence available") : tx("Source-linked operational data")}</span></div></section>
      <div className="bottom-grid"><div className="calm-card"><span className="card-symbol"><ShieldCheck size={20}/></span><div><h3>{tx("Confidence comes from evidence.")}</h3><p>{tx("Every figure has a source. Every action follows your rules.")}</p></div><button aria-label={tx("Learn about source evidence")} onClick={ask}><ArrowUpRight size={20}/></button></div><div className="calm-card"><span className="card-symbol cyan"><Sparkles size={20}/></span><div><h3>{tx("You stay in control.")}</h3><p>{tx("AERA investigates. You approve the decisions that matter.")}</p></div></div></div></>;
}
export function tierLabel(tier: number): string {
  return `Tier ${tier} \u00b7 ${tx(tier === 1 ? "Automatic" : tier === 2 ? "Human review" : "Escalated")}`;
}

function Stat({ label, value, note, sourceRef, tone, icon }: { label: string; value: string; note: string; sourceRef: string; tone: string; icon: React.ReactNode }) { return <div className={`stat ${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value"><Source sourceRef={sourceRef}>{value}</Source></div><div className="stat-note">{note}</div></div>; }
