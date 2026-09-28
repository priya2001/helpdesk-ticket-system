# Helpdesk Ticket System

A full-stack mini helpdesk built step by step. **Current milestone: authentication and user ticket management.** Users can create, list, view, update status, and delete their own tickets. Admin functionality is planned for the next step.

## Stack

- React + Vite frontend
- Node.js + Express REST API
- MongoDB + Mongoose for database integration and schema validation
- React Router for frontend routing
- bcrypt password hashing, JWT cookies, and database-backed session revocation
- Helmet headers and express-rate-limit
- CSS for responsive styling
- npm workspaces to manage both applications

## Requirements and setup

Use Node.js 24 LTS and npm (development verified with Node 24.15.0 and npm 11.12.1).

From the repository root:

```sh
npm install
cp server/.env.example server/.env
```

Generate a secret, then replace the `JWT_SECRET` placeholder in `server/.env` with the output:

```sh
node -e 'console.log(require("node:crypto").randomBytes(48).toString("hex"))'
```

Then start the application from the repository root:

```sh
npm run dev
```

Start MongoDB before `npm run dev` (see database setup below). Open http://127.0.0.1:5173. The app opens the login page. Choose **Create an account** to register and open your ticket workspace. Keep the terminal running; press Ctrl+C to stop both app servers. MongoDB runs separately.

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:4000
- Health API: http://127.0.0.1:4000/api/health

The Vite development server proxies `/api` requests to the backend. No CORS setup is necessary for this local development flow. Both servers bind to the local machine.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run frontend and backend together |
| `npm run dev --workspace=client` | Run frontend only |
| `npm run dev --workspace=server` | Run backend only |
| `npm run build` | Build frontend into `client/dist` |
| `npm start --workspace=server` | Run backend without watch mode |
| `npm test --workspace=server` | Validate models without a database |
| `npm run test:integration --workspace=server` | Test database and authentication APIs against local MongoDB |

The frontend build is not a full deployment configuration. Production hosting and API routing will be configured in a later step.

## Environment variables and database

Copy `server/.env.example` to `server/.env` once; do not overwrite an existing configuration. The server loads this file regardless of the current working directory. Restart the backend after changing `.env`.

| Variable | Required | Local development value |
| --- | --- | --- |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/helpdesk_ticket_system` |
| `JWT_SECRET` | Yes | Generate a random secret of at least 32 characters; never commit it |
| `APP_ORIGIN` | No | `http://127.0.0.1:5173`; exact frontend origin, no trailing slash |
| `NODE_ENV` | No | `development`; use `production` with HTTPS for Secure cookies |

The development ports remain 5173 (frontend) and 4000 (backend). Never commit `.env` files or paste database credentials into chat. The example contains a local URI and a placeholder secret; the server refuses to start with the placeholder.

### Local MongoDB

Install MongoDB Community Server using the instructions for your operating system at https://www.mongodb.com/docs/manual/installation/. If MongoDB already runs at `127.0.0.1:27017`, no new installation is needed. Use the local URI above.

For an installed `mongod` binary that is not already running, start it in a separate terminal:

```sh
mkdir -p "$HOME/.local/share/helpdesk-mongodb"
mongod --dbpath "$HOME/.local/share/helpdesk-mongodb" --bind_ip 127.0.0.1 --port 27017
```

Do not start a second instance on the same port. Keep this terminal running. The local configuration assumes MongoDB is bound to loopback and does not require authentication; use credentials and restricted network access when configuring a remote database.

The backend creates the `helpdesk_ticket_system` database and `users`/`tickets`/`sessions` collections during model initialization. It also creates a unique email index and an owner/date ticket index, and a session expiry TTL index. There is no manual migration or seed account in this milestone.

### MongoDB Atlas alternative

An existing Atlas database can be used by setting its driver connection URI in `server/.env`. Include the database name `helpdesk_ticket_system`, use a database user with read/write permissions for that database, and allow your current IP in Atlas network access. URL-encode special characters in credentials. Never use the application user's password as database credentials.

### Models and validation

- User: name (2–80 characters), normalized unique email, bcrypt-format `passwordHash`, role (`user` by default, or `admin`), timestamps. Password hashes are excluded from normal queries and JSON output. Registration hashes passwords with bcrypt at cost 12 before saving. Public registration always assigns the `user` role.
- Ticket: title (3–150 characters), description (10–5000), category (`Technical`, `Billing`, `Account`, `Other`), priority (`Low`, `Medium`, `High`; default `Medium`), status (`Open`, `In Progress`, `Resolved`; default `Open`), required owner reference, timestamps.
- Every ticket API requires a valid session. Creation assigns the current user as owner; reads, status updates, and deletions include that owner in the database filter. Query-based status updates use `runValidators: true`.
- Duplicate emails produce MongoDB error code `11000`; the registration API returns HTTP 409 and a friendly message.

The API starts only after MongoDB connects and indexes initialize. Startup failure exits with a safe error message; check MongoDB availability, the URI, credentials, and network access. Connection strings are not logged.

## API endpoints

### GET /api/health

Returns HTTP 200:

```json
{ "status": "ok", "message": "Helpdesk backend is running" }
```

Unknown endpoints return HTTP 404 with a JSON message.

### GET /api/ready

Pings MongoDB. Returns HTTP 200 when connected:

```json
{ "status": "ok", "database": "connected" }
```

Returns HTTP 503 with `{ "status": "error", "database": "disconnected" }` when database readiness fails after startup. `/api/health` still reports API liveness in this case.

## Authentication API

All endpoints return JSON. Successful registration and login return `{ "user": { "id", "name", "email", "role" } }` and set the session cookie. Password hashes and JWTs are not included in JSON.

| Method | Endpoint | Body / behavior |
| --- | --- | --- |
| POST | `/api/auth/register` | `name`, `email`, `password`, `confirmPassword`; 201 and automatic login |
| POST | `/api/auth/login` | `email`, `password`; 200 on success |
| POST | `/api/auth/logout` | No body; revokes the current session and clears its cookie |
| GET | `/api/auth/me` | Current user; requires a valid session cookie |

Validation errors return 400 with `message` and field `errors`. Invalid credentials or sessions return 401, disallowed origins return 403, duplicate email returns 409, and rate limits return 429 with `Retry-After`. Unknown failures return a generic 500 without internal details.

Passwords must contain at least 8 characters and no more than 72 UTF-8 bytes (bcrypt's input limit). Passwords are not trimmed. Email addresses are trimmed and lowercased. The backend independently validates all inputs and does not accept a role from registration input.

The seven-day JWT is signed with HS256, includes issuer/audience/expiry, and is stored only in an HttpOnly, SameSite=Lax cookie. Production uses Secure cookies and requires HTTPS. Each token also has a database session: logout deletes that session, and subsequent use of the old token fails. Other browsers' sessions remain signed in. Expired database sessions are checked immediately at authentication time and later removed by MongoDB's TTL cleanup. `/auth/me` loads the current user from the database instead of trusting a role in the token.

Cookie-based API writes check the exact `APP_ORIGIN` and reject cross-site Fetch Metadata. Use the documented `127.0.0.1` URL consistently, or change `APP_ORIGIN` to match your chosen frontend origin and restart the backend. Non-browser API clients without an Origin header can use the endpoints with a cookie jar.

Registration and login share a limit of 20 requests per IP per 15 minutes, including successful requests. The limiter is in memory for this single-process assessment; a multi-instance deployment would need a shared store and explicitly configured trusted proxies. No proxy is trusted by default.

## Manual checks for Step 3

1. From the repository root, run `npm run dev` once. Do not start additional copies in `client` and `server`. If an existing terminal already runs the app, use it. Stop it with Ctrl+C before restarting. The client uses `npm run dev`, not `npm start`.
2. Open http://127.0.0.1:5173/register. Submit an empty form and check field errors.
3. Enter your name, email, and a new password of at least 8 characters. Enter a different confirmation first to check validation, then correct it. Successful registration opens your ticket workspace with your name. `/dashboard` redirects to `/tickets`.
4. Refresh `/dashboard`; the session should persist.
5. Log out. Visiting `/dashboard` again should redirect to `/login`.
6. Try the wrong password, then the correct password. The error should be clear and successful login should open your ticket workspace.
7. Log out and try registering the same email; the app should show the duplicate-email error.
8. Check both forms at a narrow mobile width. Labels, errors, and buttons should remain readable.
9. Database diagnostics remain available at `/api/health` and `/api/ready`; they are no longer the homepage.

The integration tests create uniquely named `helpdesk_test_*` databases on local MongoDB and remove only those test databases afterward. They do not load `.env` or modify the application database. Tests cover validation, persistence, owner references, timestamps, hashing, unique emails, role injection, cookie flags, session revocation, expired/tampered tokens, origin protection, and rate limits.

## Ticket API

All routes require the session cookie. Responses use `{ "ticket": { ... } }` for a single ticket. Ticket fields are `id`, `title`, `description`, `category`, `priority`, `status`, `createdAt`, and `updatedAt`. Dates are ISO timestamps in the API and displayed in the browser's local time.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/tickets` | Create ticket; 201; accepts title, description, category, priority |
| GET | `/api/tickets?page=1` | Own tickets, newest first; 20 per page |
| GET | `/api/tickets/:id` | Own ticket details |
| PATCH | `/api/tickets/:id` | Update status only; body `{ "status": "In Progress" }` |
| DELETE | `/api/tickets/:id` | Permanently delete an owned ticket; 200 with confirmation message |

List responses include `tickets` and `pagination: { page, pageSize, total, totalPages }`. Page must be a positive integer up to 999999. A page beyond the result set returns an empty list. New tickets always start Open; priority defaults to Medium when omitted. Ownership and initial status are assigned server-side, ignoring any supplied owner/status on creation. PATCH accepts only status; supported transitions are any of Open, In Progress, and Resolved, including reopening.

Invalid form data, IDs, or page values return 400. Unauthenticated requests return 401. Missing and another user's tickets both return 404. The user APIs remain owner-scoped even for admin-role accounts; separate admin APIs will be added next. When a session expires during a ticket action, the frontend returns to login. It does not automatically save unsent form content.

## Manual checks for Step 4

1. Log in and open `/tickets`. A new account should see **No tickets yet**.
2. Choose **Create ticket** and submit an empty form to check validation. Then enter a title (3–150 characters), description (10–5,000), category, and priority.
3. Create the ticket. Confirm its details, Open status, chosen priority, and dates. Refresh to verify persistence.
4. Change status to In Progress, save, then try Resolved. Refresh and check the saved status and updated date.
5. Return to My tickets and confirm the ticket appears with the correct status.
6. Copy the ticket URL. Log out, register/log in as a second user, and paste it. The page should show **Ticket not found**; the second user's list must not contain the first user's ticket.
7. Return to the owner account. Click Delete ticket, then Cancel; confirm the ticket is still there. For a disposable ticket, click Delete ticket again and confirm deletion. The ticket should disappear and its old URL should return Ticket not found.
8. Check the create form, list, and details at a narrow mobile width. The list paginates after 20 tickets.

Ticket integration tests cover all five protected endpoints, owner/status injection, another user's read/update/delete attempts, status validation, timestamps, pagination, deletion, and revoked sessions. They use disposable test databases.

Admin management, screenshots, and deployment configuration will be added in subsequent milestones.
