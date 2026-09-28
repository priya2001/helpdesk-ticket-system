import { Link, useSearchParams } from 'react-router-dom';
import Workspace from '../components/Workspace.jsx';
import { Badge, dateLabel, ResourceState } from '../components/TicketUI.jsx';
import { useResource } from '../hooks/useResource.js';

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const rawPage = params.get('page') || '1';
  const page = /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  const resource = useResource(`/tickets?page=${page}`);
  const { data, loading, error } = resource;
  return <Workspace title="My tickets" description="Your requests, their progress, and the details that matter." action={<Link className="button-link" to="/tickets/new">+ Create ticket</Link>}>
    <ResourceState {...resource} />
    {!loading && !error && data && <>
      <div className="list-caption"><span>{data.pagination.total} {data.pagination.total === 1 ? 'ticket' : 'tickets'}</span><span>Newest first</span></div>
      {data.tickets.length ? <ul className="ticket-list">{data.tickets.map(ticket => <li className="ticket-row" key={ticket.id}>
        <div className="ticket-summary"><span className="ticket-category">{ticket.category}</span><h2><Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link></h2><p>Created {dateLabel(ticket.createdAt)}</p></div>
        <div className="ticket-labels"><Badge value={ticket.priority} /><Badge value={ticket.status} /><Link className="ticket-open" to={`/tickets/${ticket.id}`} aria-label={`View ticket: ${ticket.title}`}>View details →</Link></div>
      </li>)}</ul> : <section className="connection-card empty-state"><span className="connection-icon" aria-hidden="true">↗</span><h2>{page === 1 ? 'No tickets yet' : 'No tickets on this page'}</h2><p>{page === 1 ? 'Need a hand? Create your first support ticket and keep track of it here.' : 'Go back to an earlier page to see your tickets.'}</p>{page === 1 && <Link className="button-link" to="/tickets/new">Create your first ticket</Link>}</section>}
      {(data.pagination.totalPages > 1 || page > 1) && <nav className="pagination" aria-label="Ticket pages"><button disabled={page === 1} onClick={() => setParams({ page: String(page - 1) })}>Previous</button><span>Page {page} · {data.pagination.totalPages} total</span><button disabled={page >= data.pagination.totalPages} onClick={() => setParams({ page: String(page + 1) })}>Next</button></nav>}
    </>}
  </Workspace>;
}
