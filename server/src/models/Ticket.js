import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
  category: { type: String, required: true, enum: ['Technical', 'Billing', 'Account', 'Other'] },
  priority: { type: String, required: true, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, required: true, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

ticketSchema.index({ owner: 1, createdAt: -1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);
