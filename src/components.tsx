import { tx } from './tx';
import { type ReactNode } from 'react';
import { Database, X, ShieldCheck } from 'lucide-react';

export function Source({ children, sourceRef }: { children: ReactNode; sourceRef: string }) {
  return <span className="sourced" tabIndex={0} title={sourceRef} data-source-ref={sourceRef}>{children}<span className="source-tooltip"><Database size={12}/>{sourceRef}</span></span>;
}
export function Brand() { return <span className="brand"><span className="brand-icon"><img src="/brand/logo.png" alt=""/></span><span>{tx("AERA")}<span className="brand-star">{tx("✦")}</span></span></span>; }
export function Status({ value }: { value: string }) {
  const color = /APPROVAL|WAITING|REVIEW/.test(value) ? 'amber' : /CLOSED|APPROVED|MONITORING/.test(value) ? 'green' : /BLOCK|REJECT|ESCALAT/.test(value) ? 'red' : 'blue';
  return <span className={`badge ${color}`}><i/>{tx(value.replaceAll('_', ' ').toLowerCase())}</span>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty"><ShieldCheck size={32}/><h3>{title}</h3><p>{children}</p></div>; }
export function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{children}</div>; }

export function Notice({ children, close }: { children: ReactNode; close?: () => void }) { return <div className="notice" role="status"><ShieldCheck size={17}/><span>{children}</span>{close && <button aria-label={tx("Dismiss notification")} onClick={close}><X size={16}/></button>}</div>; }
