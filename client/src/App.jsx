import { useEffect, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setStatus('loading');

    async function checkConnection() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });
        if (!response.ok) throw new Error('Health check failed');
        const data = await response.json();
        if (data.status !== 'ok') throw new Error('Unexpected health response');
        if (active) setStatus('connected');
      } catch {
        if (active) setStatus('error');
      } finally {
        clearTimeout(timeout);
      }
    }

    checkConnection();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return (
    <div className="app-shell">
      <header className="header">
        <a className="brand" href="/" aria-label="Helpdesk home">
          <span className="brand-icon" aria-hidden="true">h.</span>
          <span>helpdesk<span className="brand-dot">.</span></span>
        </a>
        <span className="header-label">Support, made simple</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">YOUR SUPPORT STARTS HERE</p>
          <h1 id="page-title">Helpdesk<br />Ticket System<span className="brand-dot">.</span></h1>
          <p className="description">A dedicated space to raise requests, track progress, and get the support you need.</p>
        </section>

        <section className="connection-card" aria-labelledby="connection-title">
          <div className="card-heading">
            <span className="connection-icon" aria-hidden="true">↗</span>
            <span className="step-label">STEP 01 / SETUP</span>
          </div>
          <h2 id="connection-title">A foundation for better support.</h2>
          <p>The application setup is ready. Check the connection below to confirm the frontend and backend are working together.</p>

          <div className={`connection-status ${status}`} role="status" aria-live="polite">
            <span className="status-dot" aria-hidden="true" />
            {status === 'loading' && 'Checking backend connection…'}
            {status === 'connected' && 'Backend connected'}
            {status === 'error' && 'Unable to connect to backend'}
          </div>

          {status === 'error' && <p className="error-help">Make sure the backend is running, then try again.</p>}
          <button type="button" disabled={status === 'loading'} onClick={() => setAttempt(value => value + 1)}>
            {status === 'loading' ? 'Checking…' : 'Check connection again'}
          </button>
          <p className="setup-note">Registration and ticket management will be added in the next steps.</p>
        </section>
      </main>

      <footer>Mini Helpdesk & Support Ticket System <span>Built one step at a time.</span></footer>
    </div>
  );
}
