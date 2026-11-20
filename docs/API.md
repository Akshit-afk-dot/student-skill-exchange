# API reference

Base URL: `{PUBLIC_URL}/api/v1`

## Conventions

**Success** — always wrapped in `data`:

```json
{ "data": { … } }
```

**Error** — always this shape:

```json
{ "error": { "code": "UNPROCESSABLE", "message": "Validation failed",
             "details": { "email": "Enter a valid email address" } } }
```

`details` is present on 422 responses and maps field paths to messages, ready to attach to
form inputs.

**Paginated** responses:

```json
{ "data": { "items": [], "page": 1, "limit": 20, "total": 0,
            "totalPages": 0, "hasMore": false } }
```

**Auth** — send `Authorization: Bearer <accessToken>`. On `401` with code
`TOKEN_EXPIRED`, call `POST /auth/refresh` once and retry.

**Error codes**

| Code | Status | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | Malformed input the schema could not reject |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `TOKEN_EXPIRED` | 401 | Access token expired — refresh and retry |
| `TOKEN_REUSE_DETECTED` | 401 | Replayed refresh token; all sessions revoked |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED` | 403 | Account standing |
| `NOT_FOUND` | 404 | No such resource, or not visible to you |
| `CONFLICT` | 409 | Duplicate or invalid state transition |
| `UNPROCESSABLE` | 422 | Validation failed; see `details` |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL` | 500 | Server fault |

---

## Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create account, returns user + tokens |
| POST | `/auth/login` | — | Sign in |
| POST | `/auth/google` | — | Exchange a Google ID token for a session |
| POST | `/auth/refresh` | — | Rotate refresh token, mint access token |
| POST | `/auth/logout` | — | Revoke the presented refresh token |
| POST | `/auth/logout-all` | ✓ | Revoke every session |
| GET | `/auth/me` | ✓ | Current user |
| POST | `/auth/forgot-password` | — | Email a 6-digit reset code |
| POST | `/auth/reset-password` | — | Reset with the code |
| GET | `/auth/verify-email?token=` | — | Target of the emailed link (returns HTML) |
| POST | `/auth/resend-verification` | ✓ | Resend the verification email |
| POST | `/auth/change-password` | ✓ | Change password; revokes other sessions |
| POST/DELETE | `/auth/push-token` | ✓ | Register/unregister this phone for push (`{ token, timezone? }`, an Expo push token) |

<details>
<summary><code>POST /auth/register</code></summary>

```json
{ "name": "Rahul Sharma", "email": "rahul@college.edu", "password": "Password123",
  "college": "PES University", "department": "Computer Science", "year": 3 }
```

→ `201`

```json
{ "data": {
    "user": { "id": "…", "name": "Rahul Sharma", "email": "rahul@college.edu",
              "emailVerified": false, "rating": { "average": 0, "count": 0 }, … },
    "tokens": { "accessToken": "eyJ…", "refreshToken": "a1b2…",
                "accessExpiresIn": "15m", "refreshExpiresAt": "2026-09-19T…" } } }
```

`409` if the email exists. `422` if the password is under 8 characters or lacks a letter
or a number.
</details>

<details>
<summary><code>POST /auth/login</code></summary>

Wrong password and unknown account return the **same** `401` message, so the endpoint
cannot be used to enumerate registered addresses.
</details>

---

## Users & discovery

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users` | optional | Skill-discovery search |
| GET | `/users/facets` | — | Filter options (colleges, languages, top skills) |
| GET | `/users/me` | ✓ | Own full profile |
| PATCH | `/users/me` | ✓ | Update profile, including `notificationPrefs` (push switches by category; only the keys sent change) |
| PUT | `/users/me/location` | ✓ | Set coordinates for distance matching |
| GET | `/users/:id` | optional | Another student's public profile |

**`GET /users` query parameters**

| Param | Type | Notes |
|---|---|---|
| `q` | string | Name / college / bio |
| `skill` | ObjectId | Only students who **teach** it |
| `level` | enum | Requires `skill`; repeatable |
| `college`, `language` | string | Exact match |
| `minRating` | 0–5 | |
| `mode` | `ONLINE`\|`OFFLINE`\|`BOTH` | `BOTH` also matches specific modes |
| `onlineNow` | bool | |
| `longitude` + `latitude` | number | Both required together, or neither |
| `radiusKm` | number | Default 25 |
| `sort` | `relevance`\|`rating`\|`sessions`\|`recent` | |

Geo results include `distanceKm`. Coordinates of other students are **never** returned —
only the city label.

---

## Skills

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/skills/categories` | — | The 13 categories, in display order |
| GET | `/skills` | — | Catalogue search over names and aliases (prefix-matched, for pickers). Approved skills only |
| GET | `/skills/popular` | — | Most taught / most wanted (approved skills only) |
| GET | `/skills/check?name=` | ✓ | What adding this name as a new skill would do (below) |
| GET | `/user-skills` | ✓ | Own teach + learn lists. `skill.approved` is false while a skill the student added is in review |
| POST | `/user-skills` | ✓ | Add a skill |
| PATCH | `/user-skills/:id` | ✓ | Update level, priority, description |
| DELETE | `/user-skills/:id` | ✓ | Remove |

The catalogue (about 430 skills, with aliases such as "JS" for JavaScript) lives in
`server/src/seed/catalog.ts` and is applied on every boot. Never rename an entry there: see
the rules at the top of that file.

<details>
<summary><code>POST /user-skills</code></summary>

Either reference an existing skill:

```json
{ "skillId": "…", "type": "TEACH", "level": "ADVANCED", "yearsOfExperience": 3 }
```

…or name one, with a category in case it is new:

```json
{ "skillName": "Bonsai", "categoryId": "…", "type": "TEACH", "level": "INTERMEDIATE" }
```

A name goes through the same checks as `GET /skills/check`:

- A catalogue name or alias uses that skill ("JS" adds JavaScript).
- A name that breaks the rules returns `422` with code `SKILL_NAME_REJECTED` and the reason.
- A likely typo or a narrower wording of a catalogue skill ("Pyhton", "Advanced Excel")
  returns `409` with code `SKILL_SUGGESTION` and `details.suggestionId` /
  `details.suggestionName`. Send `"allowSimilar": true` to add the name anyway.
- Otherwise the skill is created **in review**: usable by the students who list it at once,
  hidden from search until an admin approves it or 3 different students have added it.

`409` if the skill is already on that list. For `LEARN`, `priority` (1–3) weights the
matcher.
</details>

<details>
<summary><code>GET /skills/check?name=</code></summary>

One of:

```json
{ "status": "EXISTING", "skill": { "id": "…", "name": "JavaScript", … } }
{ "status": "SUGGESTION", "kind": "TYPO", "name": "Pyhton", "suggestion": { "name": "Python", … } }
{ "status": "NEW", "name": "Bonsai", "students": 0 }
{ "status": "INVALID", "problem": "GIBBERISH", "message": "That doesn't look like a skill's name. Check the spelling." }
```

`kind` is `TYPO` or `BROADER`. `name` is the tidied name the skill would get. `students` is
how many have already added it while it waits for review. `problem` is one of `LENGTH`,
`CHARACTERS`, `CONTACT`, `SENTENCE`, `PLACEHOLDER`, `TOO_GENERAL`, `GIBBERISH`,
`INAPPROPRIATE` or `REMOVED`. The rules are in `server/src/modules/skills/quality.ts`.
</details>

---

## Matching

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/matches` | ✓ | Ranked partners |
| GET | `/matches/weights` | ✓ | Live weighting, for the UI's explanation |
| GET | `/matches/:id` | ✓ | Full breakdown for one student |

Query: `twoWayOnly`, `minScore` (0–1), `skill`, `page`, `limit`.

<details>
<summary>Response item</summary>

```json
{ "id": "…", "name": "Priya Nair", "matchScore": 0.8734, "matchPercent": 87,
  "twoWay": true,
  "breakdown": { "skill": 1, "availability": 0.83, "experience": 0.8,
                 "rating": 0.94, "location": 1 },
  "reasons": [ { "code": "TWO_WAY_EXCHANGE", "skillIds": ["…"] },
               { "code": "SAME_COLLEGE" } ],
  "theyTeachYouWant": [ { "id": "…", "name": "Figma", "level": "EXPERT" } ],
  "youTeachTheyWant": [ { "id": "…", "name": "JavaScript", "level": "ADVANCED" } ],
  "overlapMinutes": 300 }
```

Excludes: yourself, existing connections, students with an open request either way,
and suspended or banned accounts. See [MATCHING.md](MATCHING.md).
</details>

---

## Requests & connections

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/requests` | ✓ | Send a learning request |
| GET | `/requests?direction=incoming\|outgoing` | ✓ | List |
| GET | `/requests/pending-count` | ✓ | Tab badge |
| POST | `/requests/:id/accept` | ✓ | Recipient only — creates connection + conversation |
| POST | `/requests/:id/reject` | ✓ | Recipient only |
| POST | `/requests/:id/cancel` | ✓ | Sender only |
| GET | `/connections` | ✓ | Accepted exchanges |
| GET | `/connections/with/:id` | ✓ | Connected? conversation id? |
| DELETE | `/connections/:id` | ✓ | Deactivate |

The requested skill must be on the recipient's teaching list (`400` otherwise), and an
offered skill must be on the sender's (`400`). A second **pending** request for the same
skill returns `409`; a fresh request after a rejection is allowed.

`accept` returns `{ request, connectionId, conversationId }`.

---

## Chat

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/conversations` | ✓ | List with unread counts |
| GET | `/conversations/unread-count` | ✓ | Total unread |
| GET | `/conversations/:id/messages` | ✓ | Cursor-paginated, newest first |
| POST | `/conversations/:id/messages` | ✓ | Send |
| POST | `/conversations/:id/read` | ✓ | Mark read |
| DELETE | `/conversations/messages/:id` | ✓ | Soft-delete your own |

History pages by `before=<messageId>` rather than page number, because a page-numbered
chat log shifts under the reader as messages arrive. Response carries `nextCursor` and
`hasMore`.

Non-participants get `404`, not `403` — a stranger should not learn the conversation
exists. Messaging requires an **active** connection (`403` otherwise).

### Socket events

Connect to the server origin with `auth: { token: accessToken }`.

| Direction | Event | Payload |
|---|---|---|
| ← | `message:new` | The message document |
| ← | `message:read` | `{ conversationId, readerId, count }` |
| ← | `chat:typing` | `{ conversationId, userId, isTyping }` |
| ← | `presence:update` | `{ userId, isOnline }` |
| ← | `notification:new` | Notification document |
| ← | `request:new` / `request:updated` | Request id and status |
| ← | `session:updated` | `{ sessionId, status? }` |
| → | `conversation:join` / `conversation:leave` | conversation id |
| → | `chat:typing` | `{ conversationId, isTyping }` |
| → | `message:send` | Same body as the REST endpoint; acks `{ ok, message }` |
| → | `message:read` | conversation id |

---

## Sessions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/sessions` | ✓ | Schedule |
| GET | `/sessions` | ✓ | List (`when`, `role`, `status`, `from`, `to`) |
| GET | `/sessions/calendar?from=&to=` | ✓ | Calendar feed (max 1-year window) |
| GET | `/sessions/:id` | ✓ | Detail |
| PATCH | `/sessions/:id` | ✓ | Reschedule / edit |
| POST | `/sessions/:id/confirm` | ✓ | Confirm attendance |
| POST | `/sessions/:id/cancel` | ✓ | Cancel |
| POST | `/sessions/:id/complete` | ✓ | Mark done — **both** participants must call |

Rules enforced:
- Both students must be connected (`403`).
- Must be in the future (`400`).
- `ONLINE` needs `meetingLink`; `OFFLINE` needs `location` (`400`).
- Overlapping sessions for either participant return `409`. Back-to-back is fine.
- Completion before the start time returns `400`.

`complete` returns `{ session, fullyCompleted, message }`. Stats, points, streaks and
badges are applied only when `fullyCompleted` becomes true — a single-sided "done" would
let anyone inflate their own teaching hours.

---

## Reviews

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/reviews` | ✓ | Rate the other participant |
| GET | `/reviews/pending` | ✓ | Completed sessions awaiting your rating |
| GET | `/reviews/written` | ✓ | Reviews you left |
| GET | `/reviews/user/:id` | — | Public reviews (hidden ones excluded) |
| PATCH/DELETE | `/reviews/:id` | ✓ | Editable for 24 hours |

Requires a `COMPLETED` session you took part in (`400`/`403`). One review per person per
session (`409`). Rating is an integer 1–5.

---

## Notifications, gamification, reports, uploads

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | ✓ | Feed (`unreadOnly`) |
| GET | `/notifications/unread-count` | ✓ | Badge |
| POST | `/notifications/read` \| `/read-all` | ✓ | Mark read |
| GET | `/gamification/leaderboard` | ✓ | `scope=global\|college` |
| GET | `/gamification/analytics[/:id]` | ✓ | Learning analytics |
| GET | `/gamification/badges` | — | Badge catalogue and criteria |
| POST | `/reports` | ✓ | File a safety report |
| GET | `/reports/mine` | ✓ | Your reports and outcomes |
| POST | `/uploads/avatar` | ✓ | multipart, field `file`, images only |
| POST | `/uploads/attachment` | ✓ | multipart, field `file`, images + documents |

One open report per (reporter, target) pair — `409` while one is open, allowed again once
closed. Uploads are capped by `MAX_UPLOAD_MB` (default 5); oversize returns `400`.

---

## Admin

All routes require `role = ADMIN` (`403` otherwise).

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/stats` | Full dashboard payload |
| GET | `/admin/users` | Search (`q`, `status`, `college`, `sort`) |
| POST | `/admin/users/:id/moderate` | Suspend / ban / reinstate |
| GET | `/admin/reports` | Moderation queue, oldest first |
| POST | `/admin/reports/:id/claim` | Take ownership (`409` if not open) |
| POST | `/admin/reports/:id/resolve` | Apply an action and close |
| POST | `/admin/reviews/:id/visibility` | Hide / restore a review |
| GET | `/admin/skills` | Every skill with who added it (`status`: `all`, `pending`, `approved`, `removed`; `q`, `category`) |
| POST | `/admin/skills` | Add a curated skill |
| POST | `/admin/skills/:id/approve` | Approve a skill in review, or restore a removed one |
| POST | `/admin/skills/:id/reject` | Remove a student-added skill (optional `reason`) |
| POST | `/admin/skills/merge` | Fold a duplicate into the canonical skill |
| GET | `/admin/audit-log` | Every moderation action |

Moderating an account revokes all its refresh tokens immediately. Admin accounts cannot be
moderated through this API. Hiding a review recomputes the reviewee's average. Merging
skills repoints `UserSkill` rows, drops rows that would collide, and **recomputes**
counters rather than adding them. Removing a skill deletes it from every student's lists,
sends each of them a `MODERATION_NOTICE`, and keeps the name from being added again until
it is restored. Catalogue skills cannot be removed (the next deploy would restore them).

---

## Rate limits

Per authenticated user, falling back to IP for anonymous callers. Disabled in tests.

| Scope | Window | Limit |
|---|---|---|
| Global | 1 min | 300 |
| Auth endpoints | 15 min | 20 |
| Email triggers | 1 hour | 5 |
| Writes | 1 min | 60 |
| Uploads | 1 hour | 40 |

---

## Health

`GET /health` (unversioned) → `200` when the database is connected, `503` otherwise.

```json
{ "status": "ok", "uptime": 3241, "database": "connected",
  "version": "1.0.0", "timestamp": "2026-08-20T05:48:22.792Z" }
```
