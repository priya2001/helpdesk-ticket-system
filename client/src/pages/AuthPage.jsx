import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AuthPage({ mode }) {
  const registering = mode === 'register';
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  function change(event) {
    const { name, value } = event.target;
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: '' }));
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (registering && (values.name.trim().length < 2 || values.name.trim().length > 80)) next.name = 'Enter a name between 2 and 80 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) next.email = 'Enter a valid email address.';
    if (!values.password) next.password = 'Enter your password.';
    if (new TextEncoder().encode(values.password).length > 72) next.password = 'Password must be at most 72 bytes.';
    if (registering && values.password.length < 8) next.password = 'Use at least 8 characters.';
    if (registering && values.password !== values.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) {
      event.currentTarget.elements.namedItem(Object.keys(next)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const data = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(values) });
      setUser(data.user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMessage(error.message);
      setErrors(error.fields || {});
    } finally {
      setBusy(false);
    }
  }

  function field(name, label, type, autoComplete) {
    return <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} value={values[name]} onChange={change}
        required autoComplete={autoComplete} disabled={busy}
        maxLength={name === 'name' ? 80 : name === 'email' ? 254 : undefined}
        aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : name === 'password' && registering ? 'password-hint' : undefined} />
      {errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}
    </div>;
  }

  return <main className="auth-layout">
    <section className="intro">
      <p className="eyebrow">YOUR SUPPORT STARTS HERE</p>
      <h1>Less friction.<br />More support<span className="brand-dot">.</span></h1>
      <p className="description">One place for your questions, requests, and the help you need to move forward.</p>
      <div className="intro-note"><span aria-hidden="true">↗</span><p>A little help goes a long way.<br /><strong>Let’s get you started.</strong></p></div>
    </section>
    <section className="connection-card auth-card" aria-labelledby="auth-title">
      <p className="eyebrow">{registering ? 'JOIN HELPDESK' : 'YOUR HELPDESK'}</p>
      <h2 id="auth-title">{registering ? 'Create your account' : 'Welcome back'}</h2>
      <p>{registering ? 'A few details, and you’re ready to get started.' : 'Log in to your support workspace.'}</p>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        {message && <div className="form-message" role="alert">{message}</div>}
        {registering && field('name', 'Full name', 'text', 'name')}
        {field('email', 'Email address', 'email', 'email')}
        {field('password', 'Password', 'password', registering ? 'new-password' : 'current-password')}
        {registering && <p id="password-hint" className="input-hint">At least 8 characters; at most 72 bytes.</p>}
        {registering && field('confirmPassword', 'Confirm password', 'password', 'new-password')}
        <button type="submit" disabled={busy}>{busy ? (registering ? 'Creating account…' : 'Logging in…') : (registering ? 'Create account' : 'Log in')}</button>
      </form>
      <p className="auth-switch">{registering ? 'Already have an account?' : 'New to Helpdesk?'}{' '}
        <Link to={registering ? '/login' : '/register'}>{registering ? 'Log in' : 'Create an account'}</Link>
      </p>
    </section>
  </main>;
}
