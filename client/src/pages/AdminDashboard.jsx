import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Workspace from '../components/Workspace.jsx';
import { Badge, dateLabel, PRIORITIES, STATUSES, ResourceState } from '../components/TicketUI.jsx';
import { useResource } from '../hooks/useResource.js';
import { useAuthApi } from '../hooks/useAuthApi.js';

function Filters({ values, onApply }) {
  const [draft, setDraft] = useState(values);
  function change(event) { setDraft(current => ({ ...current, [event.target.name]: event.target.value })); }
  return <form className="admin-filters connection-card" onSubmit={event => { event.preventDefault(); onApply(draft); }}>
    <div className="form-field"><label htmlFor="search">Search title</label><input id="search" name="search" value={draft.search} onChange={change} maxLength={150} placeholder="Search tickets…" type="search" /></div>
    <div className="form-field"><label htmlFor="status-filter">Status</label><select id="status-filter" name="status" value={draft.status} onChange={change}><option value="">All statuses</option>{STATUSES.map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="form-field"><label htmlFor="priority-filter">Priority</label><select id="priority-filter" name="priority" value={draft.priority} onChange={change}><option value="">All priorities</option>{PRIORITIES.map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="filter-actions"><button type="submit">Apply</button><button type="button" className="button-secondary" onClick={() => { setDraft({ search: '', status: '', priority: '' }); onApply({}); }}>Clear</button></div>
  </form>;
}

function AdminTicket({ ticket, onSaved }) {
  const [status, setStatus] = useState(ticket.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useAuthApi();
  async function save(event) {
    event.preventDefault();
    if (busy || status === ticket.status) return;
    setBusy(true); setError('');
    try {
      await request(`/admin/tickets/${ticket.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <li className="admin-ticket connection-card">
    <div className="admin-ticket-heading"><div><span className="ticket-category">{ticket.category}</span><h2>{ticket.title}</h2></div><div className="ticket-badges"><Badge value={ticket.priority} /><Badge value={ticket.status} /></div></div>
    <p className="owner-line">{ticket.owner ? <>{ticket.owner.name} · {ticket.owner.email}</> : 'Account no longer available'}</p>
    <details><summary>View description and dates</summary><p className="ticket-description">{ticket.description}</p><p className="ticket-dates">Created {dateLabel(ticket.createdAt)}<br />Updated {dateLabel(ticket.updatedAt)}</p></details>
    <form className="admin-status-form" onSubmit={save}><div className="form-field"><label htmlFor={`status-${ticket.id}`}>Update status</label><select id={`status-${ticket.id}`} value={status} onChange={event => setStatus(event.target.value)} disabled={busy}>{STATUSES.map(value => <option key={value}>{value}</option>)}</select></div><button disabled={busy || status === ticket.status}>{busy ? 'Saving…' : 'Save status'}</button></form>
    {error && <p className="form-message" role="alert">{error}</p>}
  </li>;
}

export default function AdminDashboard() {
  const [params, setParams] = useSearchParams();
  const filters = { search: params.get('search') || '', status: params.get('status') || '', priority: params.get('priority') || '' };
  const query = new URLSearchParams(filters);
  query.set('page', params.get('page') || '1');
  const resource = useResource(`/admin/tickets?${query}`);
  const [message, setMessage] = useState('');
  function apply(values) {
    setMessage('');
    setParams(Object.fromEntries(Object.entries(values).filter(([, value]) => value)));
  }
  function saved() { setMessage('Ticket status updated.'); resource.retry(); }
  const { data, loading, error } = resource;
  return <Workspace title="Admin dashboard" description="See every request, find what needs attention, and keep support moving.">
    <Filters key={JSON.stringify(filters)} values={filters} onApply={apply} />
    {message && <p className="success-message" role="status">{message}</p>}
    <ResourceState {...resource} />
    {!loading && !error && data && <>
      <section className="stat-grid" aria-label="All ticket statistics">{[['Total tickets', data.statistics.total], ['Open', data.statistics.open], ['In Progress', data.statistics.inProgress], ['Resolved', data.statistics.resolved]].map(([label, count]) => <div className="stat-card" key={label}><span>{label}</span><strong>{count}</strong></div>)}</section>
      <p className="stats-note">Statistics include all tickets. Filters apply to the list below.</p>
      <div className="list-caption"><span>{data.pagination.total} matching tickets</span><span>Newest first</span></div>
      {data.tickets.length ? <ul className="admin-ticket-list">{data.tickets.map(ticket => <AdminTicket key={`${ticket.id}-${ticket.updatedAt}`} ticket={ticket} onSaved={saved} />)}</ul> : <div className="connection-card empty-state"><h2>No matching tickets</h2><p>Try clearing the filters, or check back when users create tickets.</p></div>}
      {(data.pagination.totalPages > 1 || data.pagination.page > 1) && <nav className="pagination" aria-label="Admin ticket pages"><button disabled={data.pagination.page === 1} onClick={() => setParams({ ...filters, page: String(data.pagination.page - 1) })}>Previous</button><span>Page {data.pagination.page} · {data.pagination.totalPages} total</span><button disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => setParams({ ...filters, page: String(data.pagination.page + 1) })}>Next</button></nav>}
    </>}
  </Workspace>;
}
