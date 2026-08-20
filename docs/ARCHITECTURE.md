# Architecture

## Shape of the system

```
┌─────────────────┐         ┌──────────────────┐
│  Mobile (Expo)  │         │  Admin (Vite)    │
│  React Native   │         │  React + TS      │
└────────┬────────┘         └────────┬─────────┘
         │  REST + WebSocket          │  REST
         └───────────┬────────────────┘
                     ▼
         ┌───────────────────────────┐
         │   Express 5 (TypeScript)  │
         │  ┌─────────────────────┐  │
         │  │ middleware          │  │  auth · validate · rate-limit · errors
         │  ├─────────────────────┤  │
         │  │ controllers         │  │  HTTP shape only
         │  ├─────────────────────┤  │
         │  │ services            │  │  business rules
         │  ├─────────────────────┤  │
         │  │ models (Mongoose)   │  │  schema + indexes
         │  └─────────────────────┘  │
         │   Socket.IO   ·   cron    │
         └────────────┬──────────────┘
                      ▼
                  ┌────────┐
                  │MongoDB │
                  └────────┘
```

## Module layout

Each feature is a folder under `server/src/modules/` holding, at most:

| File | Responsibility |
|---|---|
| `validators.ts` | Zod schemas — the only place request shape is asserted |
| `service.ts` | Business rules. No `req`/`res`; takes and returns plain values |
| `controller.ts` | Express router: parse → call service → serialise |

The split matters because services are what tests exercise directly and what other
services call. A controller that contained logic could not be reused by the socket layer;
`chat/service.ts` is called by both `chat/controller.ts` and `realtime/socket.ts`.

Modules: `auth`, `users`, `skills`, `matching`, `requests`, `connections`, `chat`,
`sessions`, `reviews`, `reports`, `notifications`, `gamification`, `uploads`, `admin`.

---

## Data model

Thirteen collections. Relationships are by `ObjectId` reference rather than embedding,
because almost everything here is queried from both directions.

```
User ──┬── UserSkill ──── Skill ──── SkillCategory
       │
       ├── LearningRequest ──┐
       │                     ▼
       ├── Connection ──── Conversation ──── Message
       │
       ├── Session ──── Review
       │
       ├── Report        (reporter + reportedUser)
       ├── Notification
       ├── RefreshToken
       └── AuditLog      (admin actions)
```

### Decisions worth explaining

**`UserSkill` as a join collection, not an array on `User`.**
A skill listing carries level, years of experience, description and priority; and the
matcher's hottest query is "who teaches skill X", which needs an index on the skill side.
An embedded array cannot serve that query efficiently. The unique index
`(user, skill, type)` allows a student to both teach Python *and* want to learn it at a
higher level, while preventing duplicates within a direction.

**`pairKey` for direction-independent uniqueness.**
`Connection` and `Conversation` both need "exactly one per pair of students". A unique
index on a participants *array* would be a multikey index enforcing global uniqueness of
each element — capping every user at one connection. Instead both store
`pairKey = "<smallerId>_<largerId>"` with a unique index, plus a non-unique `participants`
index for "list my connections". `ensureConnection()` upserts on `pairKey`, so two
simultaneous accepts converge on one row rather than racing.

**Partial unique indexes for state-dependent rules.**
- `LearningRequest (sender, receiver, skill)` unique *where status = PENDING* — blocks a
  duplicate open request without blocking a fresh one after a rejection.
- `Report (reporter, reportedUser)` unique *where status ∈ {OPEN, REVIEWING}* — one open
  complaint per pair, re-openable once closed.

**Denormalised counters, recomputed rather than incremented where correctness matters.**
`User.ratingAvg/ratingSum/ratingCount` and `Skill.teachCount/learnCount` exist so listings
can sort without a join. Ratings are **recomputed** from the review rows
(`recalculateRating`) rather than incremented, because moderation can hide a review and an
incremental update would drift. Skill counters are incremented, but merges recompute them
from scratch for the same reason.

**Reviews anchored to sessions, not users.**
The unique index `(session, reviewer)` is the anti-gaming measure: you cannot review
someone you never studied with, and you get one review per session. Both participants must
mark a session complete before reviews unlock, so a single student cannot manufacture a
rating opportunity.

**TTL indexes instead of cleanup jobs.**
`RefreshToken.expiresAt` (`expireAfterSeconds: 0`) and `Notification.createdAt` (90 days)
are reaped by MongoDB itself.

---

## Authentication

Two token types, deliberately different:

| | Access token | Refresh token |
|---|---|---|
| Format | JWT | 48 random bytes, hex |
| Lifetime | 15 minutes | 30 days |
| Storage | Client memory / secure store | DB row, **SHA-256 hashed** |
| Revocable | No | Yes |

A JWT cannot be revoked, so it is kept short-lived. The refresh token is opaque and stored
only as a hash — a database dump yields nothing usable.

**Rotation with reuse detection.** Every refresh issues a new token and revokes the old
one. If an already-revoked token is presented, that is a replay — the usual cause being a
stolen token used after the legitimate client rotated. The response is to revoke *every*
session for that user and return `TOKEN_REUSE_DETECTED`.

**The user is re-read on every request.** `requireAuth` loads the user document rather
than trusting the token's claims, so a suspension or role change takes effect immediately
instead of waiting out the 15-minute TTL. `rotateRefreshToken` deliberately does not mint
an access token; the caller re-reads the user first, so a demoted admin cannot keep minting
admin tokens for the life of their refresh token.

---

## Realtime

Socket.IO, authenticated in a handshake middleware with the same access token as HTTP.

Every socket joins a room named after its user id. Emitting to a user is a room emit,
which works unchanged across multiple signed-in devices and — with a Redis adapter — across
multiple server instances.

**The bus indirection.** Services need to push events, but importing the socket server
from a service that the socket handlers themselves import would be a cycle. So
`realtime/bus.ts` holds an emitter that `socket.ts` registers at startup. Before
registration, and in unit tests, emits are no-ops.

```
service ──emitToUser()──▶ bus ──(registered emitter)──▶ Socket.IO ──▶ device
```

**Presence** is set on connect and cleared on disconnect — but only once the *last* socket
for that user closes, checked via `io.in(userId).fetchSockets()`.

---

## Notification fan-out

One user-facing event reaches three channels:

1. **Persisted** — a `Notification` row (the notification centre)
2. **Realtime** — socket emit, if connected
3. **Push** — FCM, if configured and the user has device tokens

`notify()` never throws. A failed notification must not roll back the action that caused
it: a session should still be scheduled even if the reminder email bounces.

---

## Graceful degradation

Three integrations are optional, and each falls back rather than failing:

| Integration | Without credentials |
|---|---|
| Cloudinary | Uploads write to local disk, served by the API |
| Firebase (FCM) | Push disabled; in-app and realtime notifications still work |
| SMTP | Verification links and reset codes written to the server log |

This is why a fresh clone runs end to end with nothing but a MongoDB connection string.
The email flows in particular are fully testable — the verification link appears in the
server output.

---

## Error handling

One error envelope, everywhere:

```json
{ "error": { "code": "CONFLICT", "message": "…", "details": { "field": "…" } } }
```

`middleware/error.ts` is the single exit point. It translates Mongoose validation errors,
cast errors, duplicate-key errors and malformed JSON into that shape, so clients parse one
format. 5xx responses are logged with the cause; 4xx are the client's business. Stack
traces never leave the server in production.

`ApiError` carries the status and a stable machine-readable `code`, which is what the
clients branch on (`TOKEN_EXPIRED`, `ACCOUNT_SUSPENDED`, `TOKEN_REUSE_DETECTED`).

---

## Background jobs

`node-cron`, disabled by `ENABLE_JOBS=false` in tests:

| Schedule | Job |
|---|---|
| every 5 min | Session reminders, one hour ahead |
| hourly | Close sessions nobody confirmed after 48h as `NO_SHOW` |
| daily 03:00 | Expire learning requests older than 30 days |
| every 30 min | Lift suspensions whose end date has passed |

Reminders claim their row with a conditional update (`reminderSentAt` unset → set) before
sending, so an overrunning job cannot double-send.

---

## Client architecture

Both clients follow the same three layers:

```
api/client.ts    fetch wrapper: tokens, refresh-and-retry, error normalisation
api/endpoints.ts every endpoint, named and typed
screens/pages    presentation
```

**Single-flight refresh.** Several requests can 401 at once when a token expires. Both
clients share one in-flight refresh promise, because parallel refreshes would each rotate
the token and trigger the server's reuse detection — signing the user out for doing
nothing wrong.

**Token storage.** Mobile uses `expo-secure-store` (iOS keychain / Android keystore),
falling back to `localStorage` on web where SecureStore does not exist.

**Explicit serialisation.** `users/serializer.ts` builds the public shape field by field
rather than deleting from the document. A field added to the schema later is private until
someone deliberately exposes it — the opposite default from a deny-list.
