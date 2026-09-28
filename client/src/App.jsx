import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';

function AppRoutes() {
  const { user, loading, error, retry } = useAuth();
  if (loading) return <main className="state-page"><p role="status">Checking your session…</p></main>;
  if (error) return <main className="state-page"><section className="connection-card"><h2>Unable to connect</h2><p role="alert">{error}</p><button onClick={retry}>Try again</button></section></main>;
  return <Routes>
    <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage key="login" mode="login" />} />
    <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage key="register" mode="register" />} />
    <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<main className="state-page"><section><h2>Page not found</h2><p><Link to="/">Back to Helpdesk</Link></p></section></main>} />
  </Routes>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><div className="app-shell">
    <header className="header">
      <Link className="brand" to="/" aria-label="Helpdesk home"><span className="brand-icon" aria-hidden="true">h.</span><span>helpdesk<span className="brand-dot">.</span></span></Link>
      <span className="header-label">Support, made simple</span>
    </header>
    <AppRoutes />
    <footer>Mini Helpdesk & Support Ticket System <span>A little help, a lot of progress.</span></footer>
  </div></AuthProvider></BrowserRouter>;
}
