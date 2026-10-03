import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signInWithRedirect, signOut } from 'aws-amplify/auth';
import 'aws-amplify/auth/enable-oauth-listener';
import { Hub } from 'aws-amplify/utils';
import { useEffect, useState, type ReactNode } from 'react';
import { demoMode, type Role } from './api/client';

const authReady = Boolean(import.meta.env.VITE_USER_POOL_ID && import.meta.env.VITE_USER_POOL_CLIENT_ID && import.meta.env.VITE_COGNITO_DOMAIN);
if (!demoMode && authReady) Amplify.configure({ Auth: { Cognito: {
  userPoolId: import.meta.env.VITE_USER_POOL_ID, userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  loginWith: { oauth: { domain: import.meta.env.VITE_COGNITO_DOMAIN, scopes: ['openid', 'email', 'profile'], redirectSignIn: [`${window.location.origin}/callback`], redirectSignOut: [`${window.location.origin}/`], responseType: 'code' } },
} } });

export function AuthGate({ children }: { children: (roles: Role[]) => ReactNode }) {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loading, setLoading] = useState(!demoMode && authReady);
  const [error, setError] = useState('');
  useEffect(() => {
    if (demoMode || !authReady) return;
    let disposed = false;
    let version = 0;
    async function restore() {
      const current = ++version;
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        if (disposed || current !== version) return;
        const groups = session.tokens?.idToken?.payload['cognito:groups'];
        setRoles(session.tokens?.idToken ? Array.isArray(groups) ?
          groups.filter((group): group is Role => typeof group === 'string' &&
            ['planner', 'approver', 'admin'].includes(group)) : [] : null);
        setError('');
      } catch {
        if (!disposed && current === version) {
          setRoles(null);
          setError('Your session could not be restored. Please sign in.');
        }
      } finally {
        if (!disposed && current === version) setLoading(false);
      }
    }
    const stop = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'signInWithRedirect') void restore();
      if (payload.event === 'signedOut' || payload.event === 'signInWithRedirect_failure') {
        version++;
        setRoles(null);
        setLoading(false);
        setError(payload.event === 'signedOut' ? '' : 'Sign-in failed. Please retry.');
      }
    });
    void restore();
    return () => { disposed = true; version++; stop(); };
  }, []);
  if (demoMode) return children(['planner', 'approver', 'admin']);
  if (roles?.length) return children(roles);
  return <div className="sign-in"><img src="/brand/mascot.png" alt="AERA mascot"/><h1>A clearer path forward.</h1><p>Sign in to your AERA workspace.</p>{loading ? <p role="status">Restoring your session…</p> : <><p role="alert">{error || (!authReady ? 'Your administrator needs to connect this console to Cognito.' : roles ? 'Your account has no console role. Contact your administrator.' : '')}</p><button className="primary" disabled={!authReady} onClick={() => { void signInWithRedirect().catch(() => setError('Sign-in could not be started. Please retry.')); }}>Sign in securely →</button></>}</div>;
}
export async function logout() { await signOut(); }
