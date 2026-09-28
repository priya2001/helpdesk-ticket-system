export const CATEGORIES = ['Technical', 'Billing', 'Account', 'Other'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const STATUSES = ['Open', 'In Progress', 'Resolved'];

export function validateTicket(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const category = input.category;
  const priority = input.priority === undefined ? 'Medium' : input.priority;
  const errors = {};
  if (title.length < 3 || title.length > 150) errors.title = 'Title must be between 3 and 150 characters.';
  if (description.length < 10 || description.length > 5000) errors.description = 'Description must be between 10 and 5,000 characters.';
  if (!CATEGORIES.includes(category)) errors.category = 'Choose a valid category.';
  if (!PRIORITIES.includes(priority)) errors.priority = 'Choose Low, Medium, or High.';
  return { errors, value: { title, description, category, priority } };
}
