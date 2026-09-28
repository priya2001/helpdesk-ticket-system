import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Workspace from '../components/Workspace.jsx';
import { CATEGORIES, PRIORITIES } from '../components/TicketUI.jsx';
import { useAuthApi } from '../hooks/useAuthApi.js';

export default function CreateTicket() {
  const [values, setValues] = useState({ title: '', description: '', category: '', priority: 'Medium' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useAuthApi();
  const navigate = useNavigate();
  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: '' }));
    setMessage('');
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (values.title.trim().length < 3 || values.title.trim().length > 150) next.title = 'Title must be between 3 and 150 characters.';
    if (values.description.trim().length < 10 || values.description.trim().length > 5000) next.description = 'Description must be between 10 and 5,000 characters.';
    if (!CATEGORIES.includes(values.category)) next.category = 'Choose a category.';
    if (!PRIORITIES.includes(values.priority)) next.priority = 'Choose a priority.';
    setErrors(next);
    if (Object.keys(next).length) { event.currentTarget.elements.namedItem(Object.keys(next)[0])?.focus(); return; }
    setBusy(true);
    setMessage('');
    try {
      const { ticket } = await request('/tickets', { method: 'POST', body: JSON.stringify(values) });
      navigate(`/tickets/${ticket.id}`, { replace: true, state: { message: 'Ticket created successfully.' } });
    } catch (error) { setErrors(error.fields || {}); setMessage(error.message); }
    finally { setBusy(false); }
  }
  const attributes = name => ({ id: name, name, value: values[name], onChange: change, disabled: busy, required: true, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${name}-error` : undefined });
  const fieldError = name => errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>;
  return <Workspace title="Create a ticket" description="Tell us what’s happening. A few clear details can make all the difference.">
    <form className="connection-card ticket-form" onSubmit={submit} noValidate aria-busy={busy}>
      {message && <p className="form-message" role="alert">{message}</p>}
      <div className="form-field"><label htmlFor="title">Title</label><input {...attributes('title')} maxLength={150} placeholder="A short summary of the issue" />{fieldError('title')}</div>
      <div className="form-field"><label htmlFor="description">Description</label><textarea {...attributes('description')} rows={7} maxLength={5000} placeholder="What happened, and what help do you need?" />{fieldError('description')}<span className="input-hint">{values.description.length}/5,000 characters · minimum 10</span></div>
      <div className="form-columns">
        <div className="form-field"><label htmlFor="category">Category</label><select {...attributes('category')}><option value="">Select category</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select>{fieldError('category')}</div>
        <div className="form-field"><label htmlFor="priority">Priority</label><select {...attributes('priority')}>{PRIORITIES.map(value => <option key={value}>{value}</option>)}</select>{fieldError('priority')}</div>
      </div>
      <p className="input-hint">Your ticket will start with an Open status.</p>
      <div className="form-actions"><button type="submit" disabled={busy}>{busy ? 'Creating ticket…' : 'Create ticket'}</button>{!busy && <Link to="/tickets">Cancel</Link>}</div>
    </form>
  </Workspace>;
}
