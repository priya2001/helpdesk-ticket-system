import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Ticket } from '../models/Ticket.js';
import { STATUSES, validateTicket } from '../validation/tickets.js';

export const ticketRouter = Router();
ticketRouter.use(requireAuth);
ticketRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function publicTicket(ticket) {
  return {
    id: ticket._id.toString(), title: ticket.title, description: ticket.description,
    category: ticket.category, priority: ticket.priority, status: ticket.status,
    createdAt: ticket.createdAt, updatedAt: ticket.updatedAt,
  };
}

ticketRouter.post('/', async (req, res) => {
  const { errors, value } = validateTicket(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the form.', errors });
  // Only accept editable fields. Ownership and initial status are assigned here.
  const ticket = await Ticket.create({ ...value, owner: req.user._id, status: 'Open' });
  res.status(201).json({ ticket: publicTicket(ticket) });
});

ticketRouter.get('/', async (req, res) => {
  const rawPage = req.query.page ?? '1';
  if (typeof rawPage !== 'string' || !/^[1-9]\d{0,5}$/.test(rawPage)) {
    return res.status(400).json({ message: 'Page must be a positive integer up to 999999.' });
  }
  const page = Number(rawPage);
  const pageSize = 20;
  const filter = { owner: req.user._id };
  const [tickets, total] = await Promise.all([
    Ticket.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Ticket.countDocuments(filter),
  ]);
  res.json({ tickets: tickets.map(publicTicket), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
});

ticketRouter.param('id', (req, res, next, id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ message: 'Invalid ticket ID.' });
  next();
});

ticketRouter.get('/:id', async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, owner: req.user._id });
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  res.json({ ticket: publicTicket(ticket) });
});

ticketRouter.patch('/:id', async (req, res) => {
  if (!req.body || !STATUSES.includes(req.body.status) || Object.keys(req.body).some(key => key !== 'status')) {
    return res.status(400).json({ message: 'Provide only a valid ticket status.', errors: { status: 'Choose Open, In Progress, or Resolved.' } });
  }
  const ticket = await Ticket.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { $set: { status: req.body.status } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  res.json({ ticket: publicTicket(ticket) });
});

ticketRouter.delete('/:id', async (req, res) => {
  const ticket = await Ticket.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  res.json({ message: 'Ticket deleted successfully.' });
});
