import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@cloudscape-design/global-styles/index.css';
import './i18n';
import './styles.css';
import { AuthGate } from './auth';
import { App } from './App';
import type { Role } from './api/client';

function SessionWorkspace({ roles }: { roles: Role[] }) {
  const [query] = React.useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));
  React.useEffect(() => () => query.clear(), [query]);
  return <QueryClientProvider client={query}><App roles={roles}/></QueryClientProvider>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><AuthGate>{roles => <SessionWorkspace roles={roles}/>}</AuthGate></BrowserRouter></React.StrictMode>,
);
