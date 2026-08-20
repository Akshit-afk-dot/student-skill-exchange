# Student Skill Exchange

A peer-to-peer skill-sharing platform for students. One student teaches Python and wants
to learn Photoshop; another teaches Photoshop and wants Python. The system finds that
pair and ranks it above any one-way match.

Built as three parts in one repository:

| Directory | What it is | Stack |
|---|---|---|
| [`server/`](server) | REST + realtime API | Node, Express 5, TypeScript, MongoDB, Socket.IO |
| [`mobile/`](mobile) | Student app | React Native (Expo), TypeScript, React Navigation |
| [`admin/`](admin) | Moderation & analytics dashboard | React, Vite, TypeScript |

---

## The core idea: two-way matching

Most of this project is ordinary CRUD. The part that isn't is the matching algorithm in
[`server/src/modules/matching/scoring.ts`](server/src/modules/matching/scoring.ts).

Every candidate is scored out of 1.0 from five weighted signals:

```
score = 0.40 × skill compatibility
      + 0.20 × availability overlap
      + 0.15 × experience level fit
      + 0.15 × rating
      + 0.10 × location
```

Skill compatibility looks in **both directions** — what you gain from them, and what they
gain from you — and applies a 1.25× bonus when both are non-empty. That bonus is what
makes a reciprocal pair outrank an equally-skilled one-way teacher.

The module is deliberately pure: no database, no clock, no I/O. Everything arrives as a
`MatchProfile`, which is why it can be tested exhaustively. See
[`docs/MATCHING.md`](docs/MATCHING.md) for the full derivation and the reasoning behind
each weight.

---

## Getting started

**Prerequisites:** Node 20+, and a MongoDB you can reach (a free MongoDB Atlas cluster is
fine — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

```bash
git clone <your-repo-url>
cd student-skill-exchange
```

### 1. API server

```bash
cd server
npm install
cp .env.example .env    # then set MONGO_URI and the two JWT secrets
npm run seed            # optional: 10 demo students with sessions and reviews
npm run dev
```

The API starts on <http://localhost:4000>. It seeds skill categories and a 98-skill
catalogue on first boot, so it is usable immediately.

Check it is alive:

```bash
curl http://localhost:4000/health
```

### 2. Mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for an emulator. The app resolves the
API host automatically when running on a device — see the comment in
[`mobile/src/api/client.ts`](mobile/src/api/client.ts).

### 3. Admin dashboard

```bash
cd admin
npm install
npm run dev
```

Opens on <http://localhost:5173> and proxies `/api` to the server, so CORS never comes
into play locally. Sign in with the admin account created from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` in the server's `.env`.

---

## Tests

```bash
cd server
npm test
```

The suite runs against a real in-memory MongoDB rather than mocks, because the parts most
worth testing here are unique indexes, partial indexes, aggregation pipelines and geo
queries — none of which a mock exercises.

- `tests/unit/` — the scoring algorithm, exhaustively
- `tests/integration/` — auth, matching, the full request → chat → session → review
  lifecycle, and admin moderation

---

## Working on it day to day

```bash
git pull
# …make changes…
git add -A
git commit -m "What changed and why"
git push
```

Every push to `main` runs CI: typecheck, build and the full test suite for the server,
plus a typecheck and a real Metro bundle for the mobile app. The bundle step matters —
it catches broken imports that `tsc` cannot see.

Before pushing anything substantial, the same checks run locally in about a minute:

```bash
cd server && npm run typecheck && npm run lint && npm test
```

Working on a bigger change is easier on a branch:

```bash
git checkout -b feature/video-calls
# …commit as you go…
git push -u origin feature/video-calls
```

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/MATCHING.md`](docs/MATCHING.md) | The algorithm, weight by weight, with worked examples |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Step-by-step credential setup for MongoDB, Cloudinary, Firebase, Google and SMTP |
| [`docs/API.md`](docs/API.md) | Every endpoint, with request and response shapes |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Data model, module layout, realtime design |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Environment variables and going to production |

---

## Project status

Implemented end to end: registration and JWT auth with rotating refresh tokens, profiles,
skill catalogue, two-way matching, learning requests, connections, realtime chat, session
scheduling with clash detection, mutual completion, ratings and reviews, gamification
(points, streaks, badges, leaderboard), reporting and moderation, and an admin dashboard
with live analytics.

Four integrations are optional and each degrades gracefully, so the app runs end to end
with nothing but a MongoDB connection string: Cloudinary (else local disk), Firebase push
(else in-app and realtime notifications only), Google sign-in (else the button is hidden),
and SMTP (else emails are written to the server log).
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) walks through obtaining each credential.

Deployment configs are committed for Render (API), Netlify and Vercel (dashboard), plus a
multi-stage Dockerfile. No secret is in any of them.
