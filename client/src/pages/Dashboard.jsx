import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      navigate('/login', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <main className="dashboard">
    <section className="dashboard-heading">
      <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Welcome, {user.name}<span className="brand-dot">.</span></h1><p className="description">You’re signed in and ready to get started.</p></div>
      <button className="logout-button" onClick={logout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</button>
    </section>
    {error && <div className="form-message" role="alert">{error}</div>}
    <section className="dashboard-grid">
      <div className="connection-card">
        <span className="connection-icon" aria-hidden="true">↗</span>
        <h2>Your support space</h2>
        <p>Your account is ready. Ticket creation and tracking are coming in the next step.</p>
      </div>
      <div className="connection-card profile-card">
        <p className="eyebrow">ACCOUNT DETAILS</p>
        <dl><dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd className="role-label">{user.role}</dd></dl>
      </div>
    </section>
  </main>;
}
