import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Database, X, Sparkles, Send, ShieldCheck } from 'lucide-react';
import Modal from '@cloudscape-design/components/modal';
import Button from '@cloudscape-design/components/button';
import { demoMode, request } from './api/client';
import { referenceId } from './api/demo';

export function Source({ children, sourceRef }: { children: ReactNode; sourceRef: string }) {
  return <span className="sourced" tabIndex={0} title={sourceRef} data-source-ref={sourceRef}>{children}<span className="source-tooltip"><Database size={12}/>{sourceRef}</span></span>;
}
export function Brand() { return <span className="brand"><span className="brand-icon"><img src="/brand/logo.png" alt=""/></span><span>AERA<span className="brand-star">✦</span></span></span>; }
export function Status({ value }: { value: string }) {
  const color = /APPROVAL|WAITING|REVIEW/.test(value) ? 'amber' : /CLOSED|APPROVED|MONITORING/.test(value) ? 'green' : /BLOCK|REJECT|ESCALAT/.test(value) ? 'red' : 'blue';
  return <span className={`badge ${color}`}><i/>{value.replaceAll('_', ' ').toLowerCase()}</span>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty"><ShieldCheck size={32}/><h3>{title}</h3><p>{children}</p></div>; }
export function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{children}</div>; }

export function Help({ open, close }: { open: boolean; close: () => void }) {
  return <Modal visible={open} onDismiss={close} header="A clearer path from signal to resolution" footer={<Button variant="primary" onClick={close}>Got it</Button>}><p>Start with the case board. Open a case and follow the six stages to inspect its signals, impact, options, approval and execution.</p><p>Hover or focus a dotted-underlined figure to see its source. On a phone, tap the figure.</p><p>In the demo workspace, all data is synthetic and actions stay in this browser. Change the demo role in the header to explore approval and administration.</p><p>Live execution is controlled by the backend. Chat never grants approval.</p></Modal>;
}

export function Chat({ close, caseId = referenceId }: { close: () => void; caseId?: string }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ mine: false, text: demoMode ? 'Let’s make this exception clearer. I can walk you through the reference scenario. These are demo explanations, not live model responses.' : 'Ask about this case or suggest constraints for a new plan.' }]);
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput(''); setBusy(true); setMessages(m => [...m, { mine: true, text }]);
    try {
      let answer = '';
      if (demoMode) {
        answer = /approve|execute|bypass|ignore|set.*tier/i.test(text) ? 'Chat cannot approve or execute a plan, change tiers, or bypass checks. Review the plan in Approvals using an authorised approver role.' : /replan|budget|constraint/i.test(text) ? 'Your constraint would start a new plan in a connected workspace. This demo does not run a model or change the proposed plan.' : 'In the reference scenario, the supplier is late. An inter-plant transfer bridges the immediate gap, followed by air freight for the ready partial shipment. Review Impact for the source figures and Options for costs. Air freight needs a named approver.';
      } else {
        await request(`/cases/${encodeURIComponent(caseId)}/chat`, { message: text });
        answer = 'Your question was submitted. Follow the case trace for the response.';
      }
      setMessages(m => [...m, { mine: false, text: answer }]);
    } catch (error) { setMessages(m => [...m, { mine: false, text: error instanceof Error ? error.message : 'Could not send your message.' }]); }
    finally { setBusy(false); }
  }
  return <Modal visible onDismiss={close} header={<span className="inline"><Sparkles size={21}/> Ask AERA</span>} size="medium"><div className="chat-intro"><span className="badge blue">{demoMode ? 'Demo guide' : 'Case conversation'}</span><span className="muted">{caseId}</span></div><div className="chat-messages" role="log" aria-live="polite">{messages.map((m, i) => <div key={i} className={`chat-message ${m.mine ? 'mine' : ''}`}>{m.text}</div>)}</div><div className="suggestions">{['Explain this case', 'Why is approval needed?', 'Replan with a lower budget'].map(text => <button key={text} onClick={() => { void send(text); }}>{text}<ArrowUpRight size={13}/></button>)}</div><form className="chat-form" onSubmit={e => { e.preventDefault(); void send(input); }}><input aria-label="Message AERA" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question about this case…" maxLength={4000}/><button className="primary icon-button" disabled={busy || !input.trim()} aria-label="Send message"><Send size={18}/></button></form><p className="fine-print">AERA proposes. Your governance rules decide.</p></Modal>;
}
export function Notice({ children, close }: { children: ReactNode; close?: () => void }) { return <div className="notice" role="status"><ShieldCheck size={17}/><span>{children}</span>{close && <button aria-label="Dismiss notification" onClick={close}><X size={16}/></button>}</div>; }
