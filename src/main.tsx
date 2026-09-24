import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@cloudscape-design/global-styles/index.css';
import './i18n';
import './styles.css';
import { AuthGate } from './auth';
import { App } from './App';

const query = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={query}><BrowserRouter><AuthGate>{roles => <App roles={roles}/>}</AuthGate></BrowserRouter></QueryClientProvider></React.StrictMode>);
