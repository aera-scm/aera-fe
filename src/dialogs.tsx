import { tx } from './tx';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Sparkles, Send, Search, ShieldCheck, PanelLeft, BookOpen } from 'lucide-react';
import Modal from '@cloudscape-design/components/modal';
import Button from '@cloudscape-design/components/button';
import { demoMode, request } from './api/client';
import { referenceId } from './api/demo';
export function Help({ open, close }: { open: boolean; close: () => void }) {
  const stages = [
    ['Signal', 'Read the supplier update and confirm uncertain extracted fields.'],
    ['Triage', 'Check priority, urgency and the exception type.'],
    ['Impact', 'Review stock-out timing, production demand and revenue exposure.'],
    ['Options', 'Compare recovery paths, costs and verifier checks.'],
    ['Approve', 'Review evidence and irreversible actions before deciding.'],
    ['Execute', 'Follow recorded steps, SAP results and rollback availability.'],
  ];
  return <Modal visible={open} onDismiss={close} header={<span className="help-heading">Help & getting started</span>} size="large"
    footer={<Button variant="primary" onClick={close}><span className="help-heading">Got it</span></Button>}>
    <div className="help-guide">
      <div className="help-intro"><span className="help-symbol"><BookOpen size={24}/></span><div>
        <h2>A clearer path from signal to resolution</h2>
        <p>Find the exception that matters, review its evidence, then choose the next step.</p>
      </div></div>
      <section className="help-section"><h3>Start with a case</h3>
        <p>Open Overview, search by case ID, material or purchase order, and select a case. Follow these six stages:</p>
        <ol className="help-workflow" aria-label="Case workflow">{stages.map(([label, detail], index) =>
          <li key={label}><span className="help-step">{index + 1}</span><div><strong>{label}</strong><p>{detail}</p></div></li>)}</ol>
      </section>
      <div className="help-columns">
        <section className="help-section"><h3><ShieldCheck size={18}/> Know your role</h3>
          <dl className="help-roles"><div><dt>Planner</dt><dd>Investigate cases, review evidence and confirm extracted fields.</dd></div>
            <div><dt>Approver</dt><dd>Approve or reject eligible plans after explicit review.</dd></div>
            <div><dt>Admin</dt><dd>Manage workspace rules and run Scenario Lab. Admin access does not grant approval.</dd></div></dl>
        </section>
        <section className="help-section"><h3><Search size={18}/> Work faster</h3>
          <ul className="help-shortcuts"><li><kbd>/</kbd><span>Focus search on Overview. Filters and sorting stay when you return from a case.</span></li>
            <li><kbd>Esc</kbd><span>Close navigation or an open dialog.</span></li>
            <li><PanelLeft size={18}/><span>Use the panel icon to hide navigation. Drag its edge to resize; double-click to reset width.</span></li>
            <li><span className="help-source">Source</span><span>Hover or focus dotted-underlined figures to inspect evidence. On a phone, tap.</span></li></ul>
        </section>
      </div>
      <div className="help-callout"><ShieldCheck size={19}/><p>Chat explains and proposes; it never approves or executes a plan. Approval requires an authorized role and explicit confirmation. Preview actions stay local and do not create SAP documents.</p></div>
    </div>
  </Modal>;
}

export function Chat({ close, caseId = referenceId }: { close: () => void; caseId?: string }) {
  const messageList = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ mine: false, text: demoMode ? tx("Let’s make this exception clearer. I can walk you through the reference scenario. These are demo explanations, not live model responses.") : tx("Ask about this case or suggest constraints for a new plan.") }]);
  useEffect(() => { if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight; }, [messages, busy]);
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput(''); setBusy(true); setMessages(m => [...m, { mine: true, text }]);
    try {
      let answer = '';
      if (demoMode) {
        answer = /approve|execute|bypass|ignore|set.*tier/i.test(text) ? tx("Chat cannot approve or execute a plan, change tiers, or bypass checks. Review the plan in Approvals using an authorised approver role.") : /replan|budget|constraint/i.test(text) ? tx("Your constraint would start a new plan in a connected workspace. This demo does not run a model or change the proposed plan.") : tx("In the reference scenario, the supplier is late. An inter-plant transfer bridges the immediate gap, followed by air freight for the ready partial shipment. Review Impact for the source figures and Options for costs. Air freight needs a named approver.");
      } else {
        await request(`/cases/${encodeURIComponent(caseId)}/chat`, { message: text });
        answer = tx("Your question was submitted. Follow the case trace for the response.");
      }
      setMessages(m => [...m, { mine: false, text: answer }]);
    } catch (error) { setMessages(m => [...m, { mine: false, text: error instanceof Error ? error.message : tx("Could not send your message.") }]); }
    finally { setBusy(false); }
  }
  return <Modal visible onDismiss={close} header={<span className="inline chat-heading"><Sparkles size={21}/> {tx("Ask AERA")}</span>} size="medium"><div className="chat-content"><div className="chat-intro"><span className="badge blue">{tx("Case conversation")}</span><span className="muted">{caseId}</span></div><div ref={messageList} className="chat-messages" role="log" aria-live="polite">{messages.map((m, i) => <div key={i} className={`chat-message ${m.mine ? 'mine' : ''}`}>{m.text}</div>)}{busy && <p className="chat-busy" role="status">{tx("Submitting your question...")}</p>}</div><div className="suggestions">{[tx("Explain this case"), tx("Why is approval needed?"), tx("Replan with a lower budget")].map(text => <button key={text} disabled={busy} onClick={() => { void send(text); }}>{text}<ArrowUpRight size={13}/></button>)}</div><form className="chat-form" onSubmit={e => { e.preventDefault(); void send(input); }}><input aria-label={tx("Message AERA")} value={input} onChange={e => setInput(e.target.value)} placeholder={tx("Ask a question about this case…")} maxLength={4000}/><button className="primary icon-button" disabled={busy || !input.trim()} aria-label={tx("Send message")}><Send size={18}/></button></form><p className="fine-print">{tx("AERA proposes. Your governance rules decide.")}</p></div></Modal>;
}
