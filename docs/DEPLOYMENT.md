# Vercel frontend + Render backend + MongoDB Atlas

These files prepare deployment; they do not create a live site. Real hosting URLs and Atlas credentials still need to be configured.

The browser uses relative `/api` requests on Vercel. Vercel proxies them to Render; Render connects to Atlas. React is hosted only on Vercel. No `VITE_API_URL`, database secret, or JWT secret belongs in the frontend.

## 1. Atlas and the frontend domain

- Create an Atlas database and a database user with read/write access to `helpdesk_ticket_system`.
- Get the driver connection URI with that database name. URL-encode special characters in credentials. Store it only in Render's environment settings.
- Allow the Render service's outbound IP ranges in Atlas Network Access. Find them in the Render service dashboard. Temporarily allow your laptop IP if using the local admin command against Atlas.
- Obtain the stable Vercel production domain by importing/creating the Vercel project. Its initial build may intentionally fail until the backend URL is set. Use the assigned production domain, not a guessed hostname or a changing preview URL.

Local accounts and tickets are not automatically migrated to Atlas. Register fresh accounts on the deployed app unless you deliberately migrate data.

## 2. Render backend

Connect this GitHub repository, branch `main`, as a Node Web Service. Leave Root Directory blank (repository root), because the npm workspace lockfile is at the root.

| Setting | Value |
| --- | --- |
| Build | `npm ci --omit=dev` |
| Start | `npm start --workspace=server` |
| Health check | `/api/health` |
| Node | 24.x, selected by `.node-version` |

Alternatively, create a Render Blueprint using `render.yaml`. It selects the free plan and prompts for environment values. Review the resource/plan before creating it.

| Environment variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection URI including database and credentials |
| `JWT_SECRET` | New random production secret of at least 32 characters; Blueprint generates one |
| `APP_ORIGIN` | Exact Vercel production origin, e.g. `https://your-project.vercel.app`, without a trailing slash |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY_HOPS` | `1` as a conservative starting configuration behind Render |

Render supplies `PORT` automatically. The server waits for MongoDB and indexes before listening. Do not use a local MongoDB URI on Render.

Check `https://YOUR-RENDER-HOST/api/health` and `/api/ready`; both should return JSON and readiness should report `database: connected`.

## 3. Configure Vercel's API proxy

From the repository root, using the actual public Render origin:

```sh
npm run configure:vercel -- https://YOUR-RENDER-HOST.onrender.com
```

The command updates only the API destination in `vercel.json`. It rejects non-HTTPS URLs, credentials, paths/queries and the reserved `.invalid` placeholder. Commit and push this public URL before deploying Vercel.

The checked-in `.invalid` URL is intentional. `npm run build:vercel` fails until it is replaced, preventing a deployment with a broken API destination. `npm run build` remains available for local builds. Never point the API rewrite back to Vercel itself.

## 4. Vercel frontend

Use the same repository and branch. Set Root Directory to the **repository root**, not `client`. The checked-in `vercel.json` specifies:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Install | `npm ci --include=dev` |
| Build | `npm run build:vercel` |
| Output | `client/dist` |
| Node | 24.x |

The `/api/:path*` rewrite is first; the React route fallback follows it. Refreshing `/login`, `/tickets/:id`, or `/admin` should load React. Requests to `/api/*` must return backend JSON. Verify real platform routing after deployment.

Render's `APP_ORIGIN` must exactly match the final Vercel origin. Update and redeploy Render if it differs. Preview domains are intentionally not allowlisted; acceptance testing uses the stable production domain. No CORS package or cross-site cookie setting is needed for this same-origin proxy design.

Session cookies have no Domain attribute, so proxied responses store them under the frontend host. Production cookies are Secure, HttpOnly, and SameSite=Lax. API responses, including errors, are marked `no-store`.

## 5. Live acceptance checks

1. Open `/api/health` and `/api/ready` through the **Vercel** URL; verify JSON, not HTML.
2. Register and log in on Vercel. In browser developer tools, confirm the session cookie is Secure/HttpOnly under the Vercel host; do not copy its value.
3. Refresh a ticket details URL and verify both page and session persist.
4. Create, update and delete a disposable ticket. Check another user cannot access it.
5. Log out and verify protected pages/APIs reject the session.
6. Promote a cloud account and verify admin filters/counts.
7. Check API errors are not cached and check the mobile layout.

### Cloud admin account

First register on the deployed app. If your Render plan includes a shell, run the existing admin command there from the repository root. Otherwise create an ignored local `server/.env.production.local` file with only the Atlas `MONGODB_URI`, allow your current laptop IP in Atlas, and run:

```sh
node --env-file=server/.env.production.local server/scripts/make-admin.js YOUR_REGISTERED_EMAIL
```

The explicit environment takes precedence over local `.env`. Remove the temporary connection file and any temporary IP allowlist entry afterward. The command promotes only the named registered account and does not change its password.

## Troubleshooting and proxy limits

- **Vercel build guard:** configure the real Render URL, commit/push, then redeploy.
- **403 origin error:** correct Render's `APP_ORIGIN` and use the stable frontend domain. Do not switch to SameSite=None as a workaround.
- **502/504 or initial timeout:** check Render logs/health. Free services can sleep after inactivity; wait for the API to wake and retry. Writes are not automatically replayed. Check the ticket list before repeating a timed-out creation.
- **MongoDB startup failure:** verify credentials, database name and Render outbound IP allowlisting.
- **Refresh 404:** ensure Vercel loads the root `vercel.json`.
- **Rate limits behind proxies:** do not set `trust proxy: true` or increase hops blindly. The public Render URL can bypass Vercel, so paths can have different lengths. The one-hop setting does not trust arbitrary leftmost forwarded IPs, but may group requests by Vercel egress IP depending on live forwarding. Inspect the deployed proxy chain before changing it. The in-memory limiter is for this single-instance assessment.

Local tests validate configuration, production cookie attributes, origin enforcement, cache headers and server settings. Actual Vercel forwarding and Render proxy behavior require live verification after resources exist. No live deployment is claimed here.

References: [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Render web services](https://render.com/docs/web-services), [Render outbound IPs](https://render.com/docs/outbound-ip-addresses), [Express proxy configuration](https://expressjs.com/en/guide/behind-proxies/).
