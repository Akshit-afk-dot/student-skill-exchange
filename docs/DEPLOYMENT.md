# Deployment

## Before you go live

The server refuses to start in production with insecure secrets, so some of this is
enforced rather than advisory.

| | Why |
|---|---|
| **`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`** — 32+ chars each, different from one another | Enforced at boot. The dev defaults would let anyone mint a valid token |
| **`CORS_ORIGINS`** set to your real dashboard origin | Enforced at boot. Empty means "allow anything", which is fine locally and not in production |
| **`MONGO_URI`** pointing at a real cluster with auth | |
| **`ADMIN_EMAIL` / `ADMIN_PASSWORD`** | Creates the first admin on boot, once. Change the password after first sign-in |
| **`PUBLIC_URL`** set to the deployed API URL | Verification links in emails are built from it |
| **Cloudinary** configured, if the host has an ephemeral filesystem | Otherwise uploads vanish on redeploy |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 1. Database — MongoDB Atlas

The free M0 tier is enough for a project demo and viva.

1. Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → add your host's egress IPs. `0.0.0.0/0` works if the platform has
   no fixed IPs, but then the database user's password is your only protection — make it
   long.
4. Copy the connection string and append the database name:

```
mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/student-skill-exchange?retryWrites=true&w=majority
```

Indexes are declared in the schemas and built on connect. Nothing to run by hand.

---

## 2. API server

```bash
cd server
npm ci
npm run build      # tsc → dist/
npm start          # node dist/index.js
```

Set every variable from [`server/.env.example`](../server/.env.example) in the platform's
environment settings rather than committing a `.env`.

The server listens on `PORT` (default 4000), exposes `GET /health` for probes, and drains
gracefully on `SIGTERM` — it stops the cron jobs, closes sockets, lets in-flight requests
finish, then disconnects from MongoDB, with a 15-second hard timeout so a stuck socket
cannot hang a rolling deploy.

### Render (blueprint committed)

[`render.yaml`](../render.yaml) at the repo root describes the service, so you do not
configure it by hand:

1. Render dashboard → **New → Blueprint** → point it at this repository.
2. Render reads `render.yaml`, creates the service, and **generates both JWT secrets
   itself**.
3. Fill in the values marked `sync: false` in the dashboard: `MONGO_URI`, `PUBLIC_URL`
   (the service's own URL), `CORS_ORIGINS` (the dashboard's URL), `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, and any optional integration keys.

No secret is in the file — that is the point of `sync: false`.

Note the free plan sleeps after 15 minutes idle, and the first request afterwards takes
roughly 30 seconds to wake it. For a live viva, hit the URL a minute beforehand.

### Railway / Fly / anything else

- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check path: `/health`
- Root directory: `server`

**These platforms have ephemeral filesystems.** Configure Cloudinary, or uploaded avatars
and attachments disappear on every redeploy. The server logs which storage driver it chose
at boot.

### Behind a proxy

`app.set('trust proxy', 1)` is already set, so rate limiting and logging read the real
client IP from `X-Forwarded-For`. If you sit behind more than one proxy hop, raise that
number to match.

### Docker

A multi-stage [`server/Dockerfile`](../server/Dockerfile) is committed:

```bash
cd server
docker build -t skill-exchange-api .
docker run -p 4000:4000 --env-file .env skill-exchange-api
```

It builds with dev dependencies, ships only `dist/` plus production dependencies, runs as
the unprivileged `node` user, and carries a `HEALTHCHECK` hitting `/health`.

Note `pino-pretty` is a devDependency, so `--omit=dev` drops it. The logger detects that
and falls back to JSON output rather than failing to boot.

---

## 3. Admin dashboard

```bash
cd admin
npm ci
VITE_API_URL=https://your-api.example.com npm run build
```

`dist/` is a static bundle — deploy to Netlify, Vercel, Cloudflare Pages, or any static
host. Configs are committed for the first two
([`admin/netlify.toml`](../admin/netlify.toml), [`admin/vercel.json`](../admin/vercel.json)),
both of which already include the SPA rewrite and sensible caching headers.

Two things to get right:

1. **`VITE_API_URL` is baked in at build time.** Changing it means rebuilding.
2. **Add the dashboard's origin to `CORS_ORIGINS` on the server.** Note that
   `http://localhost:5173` and `http://127.0.0.1:5173` are *different origins* — list both
   if you use both.

The dashboard is a single-page app, so the host must rewrite unknown paths to
`index.html`, or a refresh on `/users` will 404. Both committed configs do this; on
another host you must set it up yourself.

---

## 4. Mobile app

Set the API URL in `mobile/app.json` under `expo.extra.apiUrl`, or via
`EXPO_PUBLIC_API_URL`.

```bash
cd mobile
npm ci
npx expo start          # development
```

For a shareable build:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview   # installable APK
```

`--profile preview` produces an APK you can hand out directly, which is usually what a
project demo needs. A Play Store build (`--profile production`) produces an AAB and
requires a developer account.

The app resolves `localhost` API URLs to the Expo host machine automatically, so a
physical device on the same network reaches your dev server without configuration. That
only applies in development — production builds use the configured URL verbatim.

---

## Optional integrations

Cloudinary, Firebase push, Google sign-in and SMTP each have a step-by-step credential
walkthrough in **[INTEGRATIONS.md](INTEGRATIONS.md)** — where to click, what to copy, and
how to verify it worked.

All four are optional. The server logs which are active at boot and falls back cleanly
when they are absent, so a deployment with none of them still works end to end.

The one worth doing before you deploy is **Cloudinary**: Render, Railway and Fly wipe the
filesystem on every deploy, so without it uploaded photos vanish.

---

## Operating it

**Logs.** Newline-delimited JSON in production. Authorization headers, cookies, passwords
and tokens are redacted by the logger.

**Health.** `GET /health` returns 503 when MongoDB is disconnected, so an orchestrator
restarts or reroutes rather than serving broken requests.

**Background jobs** run in-process. If you scale to multiple instances, every instance
runs them. Reminders are safe — they claim their row before sending — but you would want
to set `ENABLE_JOBS=false` on all but one instance, or move the jobs to a scheduler.

**Scaling realtime.** Socket.IO holds connections in memory. Beyond one instance, add
`@socket.io/redis-adapter` so room emits reach sockets on other instances. Nothing else in
the realtime code changes — the bus indirection already routes everything through room
emits.

**Backups.** Atlas takes automated snapshots on paid tiers. On M0, take periodic
`mongodump` backups yourself.

---

## Known limitations

| Limitation | Impact | Fix when needed |
|---|---|---|
| Matching scores in application memory, capped at 500 candidates | Fine for a college; would not suit 100k users | Move scoring to a scheduled job writing a precomputed match table |
| Background jobs run in-process | Duplicated across instances | `ENABLE_JOBS=false` on all but one, or an external scheduler |
| Socket.IO is single-instance | Realtime breaks across instances | Redis adapter |
| Local disk storage is not durable on ephemeral hosts | Uploads lost on redeploy | Configure Cloudinary |
| `firebase-admin` pulls a transitive `uuid` advisory (moderate) | No practical exposure — the affected code path takes an explicit buffer we never pass | Resolves when firebase-admin updates its dependency |
