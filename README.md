# Helpdesk Ticket System

A full-stack mini helpdesk built step by step. **Current milestone: frontend/backend foundation, MongoDB connection, and User/Ticket models.** Authentication and ticket/admin APIs are not yet implemented.

## Stack

- React + Vite frontend
- Node.js + Express REST API
- MongoDB + Mongoose for database integration and schema validation
- CSS for responsive styling
- npm workspaces to manage both applications

## Requirements and setup

Use Node.js 24 LTS and npm (development verified with Node 24.15.0 and npm 11.12.1).

From the repository root:

```sh
npm install
cp server/.env.example server/.env
npm run dev
```

Start MongoDB before `npm run dev` (see database setup below). Open http://127.0.0.1:5173. The page should show **Backend connected** and **Database connected**. Keep the terminal running; press Ctrl+C to stop both app servers. MongoDB runs separately.

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
| `npm run test:integration --workspace=server` | Test persistence and readiness against local MongoDB |

The frontend build is not a full deployment configuration. Production hosting and API routing will be configured in a later step.

## Environment variables and database

Copy `server/.env.example` to `server/.env` once; do not overwrite an existing configuration. The server loads this file regardless of the current working directory. Restart the backend after changing `.env`.

| Variable | Required | Local development value |
| --- | --- | --- |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/helpdesk_ticket_system` |

The development ports remain 5173 (frontend) and 4000 (backend). Never commit `.env` files or paste database credentials into chat. The example contains only a local, credential-free URI.

### Local MongoDB

Install MongoDB Community Server using the instructions for your operating system at https://www.mongodb.com/docs/manual/installation/. If MongoDB already runs at `127.0.0.1:27017`, no new installation is needed. Use the local URI above.

For an installed `mongod` binary that is not already running, start it in a separate terminal:

```sh
mkdir -p "$HOME/.local/share/helpdesk-mongodb"
mongod --dbpath "$HOME/.local/share/helpdesk-mongodb" --bind_ip 127.0.0.1 --port 27017
```

Do not start a second instance on the same port. Keep this terminal running. The local configuration assumes MongoDB is bound to loopback and does not require authentication; use credentials and restricted network access when configuring a remote database.

The backend creates the `helpdesk_ticket_system` database and `users`/`tickets` collections during model initialization. It also creates a unique email index and an owner/date ticket index. There is no manual migration or seed account in this milestone.

### MongoDB Atlas alternative

An existing Atlas database can be used by setting its driver connection URI in `server/.env`. Include the database name `helpdesk_ticket_system`, use a database user with read/write permissions for that database, and allow your current IP in Atlas network access. URL-encode special characters in credentials. Never use the application user's password as database credentials.

### Models and validation

- User: name (2–80 characters), normalized unique email, bcrypt-format `passwordHash`, role (`user` by default, or `admin`), timestamps. Password hashes are excluded from normal queries and JSON output. Actual hashing and login are implemented in Step 3.
- Ticket: title (3–150 characters), description (10–5000), category (`Technical`, `Billing`, `Account`, `Other`), priority (`Low`, `Medium`, `High`; default `Medium`), status (`Open`, `In Progress`, `Resolved`; default `Open`), required owner reference, timestamps.
- An owner reference describes the relationship; the later ticket service must check owner existence and enforce ownership. Later registration must assign roles server-side. Query-based updates must use `runValidators: true`, or load/save a validated document.
- Duplicate emails produce MongoDB error code `11000`; the upcoming auth API will translate that into a friendly response.

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

## Manual checks for Step 2

1. Start MongoDB and both app servers. Confirm `MongoDB connected` in the terminal and **Backend connected** plus **Database connected** on the page.
2. Click **Check connection again** to repeat the health check.
3. Open `/api/health` and `/api/ready` on the backend and confirm the JSON responses above.
4. Reduce the browser width to check the mobile layout.
5. To check the error state, stop the combined command and start only the frontend. The page should show **Unable to connect to backend**. Start the backend in another terminal and click **Check connection again** to recover.

Integration tests create a uniquely named `helpdesk_test_*` database on local MongoDB and remove only that test database afterward. They do not load `.env` or modify the application database. They check persistence, owner population, timestamps, unique emails, hash exclusion, readiness, and failed connections.

Screenshots and remaining API documentation will be added as those milestones are completed.
