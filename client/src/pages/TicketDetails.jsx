import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Workspace from '../components/Workspace.jsx';
import { Badge, STATUSES, dateLabel, ResourceState } from '../components/TicketUI.jsx';
import { useResource } from '../hooks/useResource.js';
import { useAuthApi } from '../hooks/useAuthApi.js';

function TicketContent({ ticket, onUpdate }) {
  const request = useAuthApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState(ticket.status);
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(location.state?.message || '');

  // Show navigation feedback once; refreshing should not repeat a creation notice.
  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  async function updateStatus(event) {
    event.preventDefault();
    if (busy || status === ticket.status) return;
    setBusy('update'); setError(''); setMessage('');
    try {
      const data = await request(`/tickets/${ticket.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onUpdate(data.ticket);
      setMessage('Ticket status updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }

  async function deleteTicket() {
    if (busy) return;
    setBusy('delete'); setError(''); setMessage('');
    try {
      await request(`/tickets/${ticket.id}`, { method: 'DELETE' });
      navigate('/tickets', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }

  return <>
    {message && <p className="success-message" role="status">{message}</p>}
    {error && <p className="form-message" role="alert">{error}</p>}
    <div className="ticket-detail-grid">
      <article className="connection-card ticket-body"><div className="ticket-badges"><Badge value={ticket.status} /><Badge value={ticket.priority} /></div><h2>{ticket.title}</h2><h3>Description</h3><p className="ticket-description">{ticket.description}</p><dl className="ticket-metadata"><dt>Category</dt><dd>{ticket.category}</dd><dt>Created</dt><dd>{dateLabel(ticket.createdAt)}</dd><dt>Updated</dt><dd>{dateLabel(ticket.updatedAt)}</dd></dl></article>
      <aside className="ticket-controls">
        <form className="connection-card" onSubmit={updateStatus}><h2>Update status</h2><div className="form-field"><label htmlFor="ticket-status">Status</label><select id="ticket-status" value={status} onChange={event => { setStatus(event.target.value); setMessage(''); }} disabled={Boolean(busy) || confirming}>{STATUSES.map(value => <option key={value}>{value}</option>)}</select></div><button disabled={Boolean(busy) || confirming || status === ticket.status}>{busy === 'update' ? 'Saving…' : 'Save status'}</button></form>
        <section className="connection-card delete-section"><h2>Delete ticket</h2><p>Deleting a ticket permanently removes it.</p>
          {confirming ? <div role="group" aria-label="Confirm ticket deletion"><p>Delete “{ticket.title}”?</p><div className="delete-actions"><button className="button-danger" onClick={deleteTicket} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Yes, delete ticket'}</button><button className="button-secondary" onClick={() => setConfirming(false)} disabled={Boolean(busy)}>Cancel</button></div></div> : <button className="button-danger-outline" onClick={() => setConfirming(true)} disabled={Boolean(busy)}>Delete ticket</button>}
        </section>
      </aside>
    </div>
  </>;
}

export default function TicketDetails() {
  const { id } = useParams();
  const resource = useResource(`/tickets/${encodeURIComponent(id)}`);
  return <Workspace title="Ticket details" description="Review your request and keep its status up to date." action={<Link className="back-link" to="/tickets">← All tickets</Link>}>
    <ResourceState {...resource} />
    {!resource.loading && !resource.error && resource.data && <TicketContent key={id} ticket={resource.data.ticket} onUpdate={ticket => resource.setData({ ticket })} />}
  </Workspace>;
}
