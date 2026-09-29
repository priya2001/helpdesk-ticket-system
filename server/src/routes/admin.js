import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Ticket } from '../models/Ticket.js';
import { PRIORITIES, STATUSES } from '../validation/tickets.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access is required.' });
  next();
});

function serialize(ticket) {
  return {
    id: ticket._id.toString(), title: ticket.title, description: ticket.description,
    category: ticket.category, priority: ticket.priority, status: ticket.status,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt,
    owner: ticket.owner ? { name: ticket.owner.name, email: ticket.owner.email } : null,
  };
}

adminRouter.get('/tickets', async (req, res) => {
  const { status = '', priority = '', search = '', page = '1' } = req.query;
  if (typeof status !== 'string' || (status && !STATUSES.includes(status)) ||
      typeof priority !== 'string' || (priority && !PRIORITIES.includes(priority)) ||
      typeof search !== 'string' || search.length > 150 ||
      typeof page !== 'string' || !/^[1-9]\d{0,5}$/.test(page)) {
    return res.status(400).json({ message: 'Invalid filters. Use an allowed status/priority, a title search up to 150 characters, and a positive page number up to 999999.' });
  }
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  // Escape regex syntax so the query is a literal, case-insensitive substring.
  if (search.trim()) filter.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const pageSize = 20;
  const [tickets, total, groups] = await Promise.all([
    Ticket.find(filter).sort({ createdAt: -1, _id: -1 }).skip((Number(page) - 1) * pageSize).limit(pageSize).populate('owner', 'name email').lean(),
    Ticket.countDocuments(filter),
    Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const statistics = { total: 0, open: 0, inProgress: 0, resolved: 0 };
  const keys = { Open: 'open', 'In Progress': 'inProgress', Resolved: 'resolved' };
  for (const group of groups) {
    statistics.total += group.count;
    if (keys[group._id]) statistics[keys[group._id]] = group.count;
  }
  res.json({ tickets: tickets.map(serialize), statistics, pagination: { page: Number(page), pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
});

adminRouter.patch('/tickets/:id', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid ticket ID.' });
  if (!req.body || !STATUSES.includes(req.body.status) || Object.keys(req.body).some(key => key !== 'status')) {
    return res.status(400).json({ message: 'Provide only a valid ticket status.' });
  }
  const ticket = await Ticket.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { returnDocument: 'after', runValidators: true }).populate('owner', 'name email');
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  res.json({ ticket: serialize(ticket) });
});
