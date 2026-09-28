import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';

export default function Workspace({ title, description, children, action }) {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  async function logout() {
    setBusy(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      navigate('/login', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="workspace">
    <nav className="workspace-nav" aria-label="Workspace"><Link to="/tickets">My tickets</Link><div><span className="account-name">{user.name}</span><button className="button-secondary compact-button" onClick={logout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</button></div></nav>
    {error && <p className="form-message" role="alert">{error}</p>}
    <section className="dashboard-heading"><div><p className="eyebrow">YOUR SUPPORT WORKSPACE</p><h1>{title}</h1><p className="description">{description}</p></div>{action}</section>
    {children}
  </main>;
}
