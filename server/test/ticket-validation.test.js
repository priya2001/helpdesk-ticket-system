import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTicket } from '../src/validation/tickets.js';

test('ticket creation trims text and ignores owner/status injection', () => {
  const result = validateTicket({ title: ' Help me ', description: ' A detailed support request. ', category: 'Other', owner: 'injected', status: 'Resolved' });
  assert.deepEqual(result, { errors: {}, value: { title: 'Help me', description: 'A detailed support request.', category: 'Other', priority: 'Medium' } });
});
test('ticket creation rejects missing, invalid, non-string, and oversized input', () => {
  for (const body of [null, [], { title: { $ne: null }, description: 123, category: 'Invalid', priority: null }, { title: 'a'.repeat(151), description: 'a'.repeat(5001), category: [], priority: 'Urgent' }]) {
    const { errors } = validateTicket(body);
    assert.ok(errors.title);
    assert.ok(errors.description);
    assert.ok(errors.category);
  }
  assert.ok(validateTicket({ title: '   ', description: '        ' }).errors.title);
});
