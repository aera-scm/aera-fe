import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { demoMode, request } from './client';

export function useRealtime(caseId?: string) {
  const query = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    setConnected(false);
    if (demoMode || !import.meta.env.VITE_WS_URL) return;
    let disposed = false;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      void query.invalidateQueries({ queryKey: ['cases'] });
      void query.invalidateQueries({ queryKey: ['trace'] });
    }
    function retry() {
      if (!disposed) timer = setTimeout(() => { void connect(); }, 5000);
    }
    async function connect() {
      try {
        const url = new URL(import.meta.env.VITE_WS_URL);
        if (url.protocol !== 'wss:') throw new Error('Secure WebSocket is required');
        const result = await request<{ ticket: string }>('/realtime/ticket', {});
        if (disposed) return;
        if (typeof result.ticket !== 'string' || !result.ticket) throw new Error('Invalid realtime ticket');
        url.searchParams.set('ticket', result.ticket);
        const current = new WebSocket(url);
        socket = current;
        current.onopen = () => {
          if (disposed) return;
          current.send(JSON.stringify(caseId ? { action: 'subscribe', caseId } : { action: 'subscribe', board: true }));
          setConnected(true);
          refresh();
        };
        current.onmessage = () => { if (!disposed) refresh(); };
        current.onerror = () => current.close();
        current.onclose = () => { if (!disposed) { setConnected(false); retry(); } };
      } catch { retry(); }
    }
    void connect();
    return () => { disposed = true; clearTimeout(timer); socket?.close(); };
  }, [query, caseId]);
  return connected;
}
