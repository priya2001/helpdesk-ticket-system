export const CATEGORIES = ['Technical', 'Billing', 'Account', 'Other'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const STATUSES = ['Open', 'In Progress', 'Resolved'];

export function Badge({ value }) {
  return <span className={`badge badge-${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</span>;
}

export function dateLabel(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ResourceState({ loading, error, retry }) {
  if (loading) return <div className="connection-card" role="status">Loading tickets…</div>;
  if (error) return <div className="connection-card"><p role="alert">{error.message}</p>{error.status !== 404 && error.status !== 400 && <button className="compact-button" onClick={retry}>Try again</button>}</div>;
  return null;
}
