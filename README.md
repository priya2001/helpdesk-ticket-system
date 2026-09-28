# Helpdesk Ticket System

A full-stack mini helpdesk built step by step. **Current milestone: basic frontend/backend setup only.** Authentication, database integration, user tickets, and admin features are planned and not yet implemented.

## Stack

- React + Vite frontend
- Node.js + Express REST API
- CSS for responsive styling
- npm workspaces to manage both applications

## Requirements and setup

Use Node.js 24 LTS and npm (development verified with Node 24.15.0 and npm 11.12.1).

From the repository root:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. The page checks the backend and displays **Backend connected** on success. Keep the terminal running; press Ctrl+C to stop both servers.

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

The frontend build is not a full deployment configuration. Production hosting and API routing will be configured in a later step.

## Environment variables and database

No environment variables or database are required for Step 1. The development ports are configured in `client/vite.config.js` and `server/src/index.js`. Database setup and a safe `.env.example` will be added with database integration. Never commit secret `.env` files.

## API endpoints

### GET /api/health

Returns HTTP 200:

```json
{ "status": "ok", "message": "Helpdesk backend is running" }
```

Unknown endpoints return HTTP 404 with a JSON message.

## Manual checks for Step 1

1. Start both servers and open the frontend. Confirm the heading and **Backend connected** message.
2. Click **Check connection again** to repeat the health check.
3. Open the health API directly and confirm the JSON response above.
4. Reduce the browser width to check the mobile layout.
5. To check the error state, stop the combined command and start only the frontend. The page should show **Unable to connect to backend**. Start the backend in another terminal and click **Check connection again** to recover.

Screenshots and complete API/database documentation will be added as those milestones are completed.
