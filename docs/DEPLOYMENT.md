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

### Render / Railway / Fly

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

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

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
host.

Two things to get right:

1. **`VITE_API_URL` is baked in at build time.** Changing it means rebuilding.
2. **Add the dashboard's origin to `CORS_ORIGINS` on the server.** Note that
   `http://localhost:5173` and `http://127.0.0.1:5173` are *different origins* — list both
   if you use both.

The dashboard is a single-page app, so configure the host to rewrite unknown paths to
`index.html`, or a refresh on `/users` will 404.

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

### Cloudinary (file storage)

Sign up, copy Cloud Name / API Key / API Secret from the dashboard into
`CLOUDINARY_*`. The server switches drivers at boot and logs which one it picked.

### Firebase Cloud Messaging (push)

1. Create a Firebase project.
2. **Project settings → Service accounts → Generate new private key**.
3. From the JSON, set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
   `FIREBASE_PRIVATE_KEY`.

The private key contains newlines. Put it on one line with literal `\n` where the newlines
were — the server converts them back.

Without these, push is disabled and everything else still works.

### Google sign-in

Create OAuth client IDs in Google Cloud Console (one per platform: web, iOS, Android) and
list them comma-separated in `GOOGLE_CLIENT_IDS`. These are the *audiences* the server
accepts, which is what stops a token minted for another app being replayed against yours.

### SMTP (email)

Any provider works. For Gmail you need an **app password**, not your account password.
Without SMTP, verification links and reset codes are written to the server log — enough to
test both flows end to end.

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
