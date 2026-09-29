# Final verification

Run from the repository root:

```sh
npm test
npm run test:integration
npm run build
npm audit --omit=dev
```

The integration tests require local MongoDB at `127.0.0.1:27017`. They create isolated `helpdesk_test_*` databases and remove those databases after completion. They never load the application's `.env` or use its database.

## Verified during Step 6

- Frontend API handling: cookie credentials, timeout signal, field errors, network failure, unreadable JSON/HTML payloads, and preserving HTTP status for session expiry.
- Backend tests: registration, hashing, login/logout, session revocation and expiry, owner isolation, ticket CRUD/status validation, admin authorization, combined filters, literal search, statistics, pagination, and the admin promotion command.
- Production frontend build completed.
- Production dependency audit reported zero vulnerabilities at the time of verification; this is a point-in-time dependency check, not a security guarantee.
- Browser: incorrect-password feedback and subsequent successful login; session persistence on navigation; normal-user admin denial; missing-ticket state; logout and protected-route redirect.
- Mobile: 320px ticket list and details with a maximum-length unbroken title. No horizontal overflow. HTML-like description content rendered as text, without injected script elements.

Earlier milestone browser checks also covered form validation, ticket creation, status changes and refresh persistence, delete confirmation cancellation, admin filters/count updates, and 390px layouts.

Final QA found and fixed an API error-handling bug: malformed successful responses were previously converted to an empty object. They now raise a readable error instead of continuing with invalid page data. Regression tests reproduce the original failure and pass after the fix.

Browser checks used temporary test accounts and tickets, removed afterward. Existing user data and running app processes were preserved. Registration/deletion success paths are covered by HTTP integration tests; the user should also complete the browser checklist below.

## User acceptance checklist

1. Register, log out, and log in. Check a wrong password and duplicate email.
2. Create a disposable ticket; refresh its details, update its status, and verify the list.
3. Cancel deletion once, then confirm deletion of that disposable ticket.
4. Try another user's ticket URL and the admin page from a normal account; access must be blocked.
5. As admin, combine title/status/priority filters and update a ticket; verify both the owner view and the statistics.
6. Use a narrow browser window to check forms and buttons.

Fresh-install verification, submission screenshots, and deployment testing belong to the submission-preparation step and are not claimed complete here.
