# The two-way matching algorithm

Implementation: [`server/src/modules/matching/scoring.ts`](../server/src/modules/matching/scoring.ts)
Tests: [`server/tests/unit/scoring.test.ts`](../server/tests/unit/scoring.test.ts)

This is the part of the project that is not CRUD. Everything else stores and retrieves
records; this decides who should learn from whom.

---

## The problem

A student search box answers "who teaches Python?". That is useful but shallow — it
ignores that the searcher has something to offer, and it ranks a teacher who is never
free the same as one who studies down the corridor.

The situation worth solving is the reciprocal one:

```
Student A  teaches Python      wants Photoshop
Student B  teaches Photoshop   wants Python
                    ↓
           Both needs met by one pairing
```

Neither student pays anything; each is the other's teacher. The algorithm's job is to
find those pairs and rank them above one-way matches.

---

## The score

Five components, each normalised to `[0, 1]`, combined by weights that sum to exactly 1:

```
score = 0.40 × skill
      + 0.20 × availability
      + 0.15 × experience
      + 0.15 × rating
      + 0.10 × location
```

Because the weights sum to 1 and each component is bounded, the result is always in
`[0, 1]`. The weights are configurable per deployment (`MATCH_W_*`), and the server
**refuses to start** if they do not sum to 1 — a set that sums to 0.9 would silently
rescale every score and make results incomparable between environments.

The score is **asymmetric on purpose**: what A gains from B is not what B gains from A.
`computeMatchScore(me, other)` always answers "how good is `other` *for me*".

---

## 1. Skill compatibility — 40%

The dominant term, because a partner who cannot teach what you want is worthless however
convenient they are.

Two directions are computed:

- **inbound** — skills *I* want to learn that *they* teach (what I gain)
- **outbound** — skills *they* want to learn that *I* teach (what they gain)

Each side is measured as **coverage**: the fraction of that person's learning demand the
other can satisfy, weighted by the learner's own stated priority (1 = nice to have,
3 = top priority).

```
coverage = Σ(priority of matched wants) / Σ(priority of all wants)
```

Priority weighting matters. A student whose top priority is Machine Learning and whose
afterthought is Guitar should not see a guitarist ranked equal to an ML researcher.

The two directions combine at **65% inbound / 35% outbound**:

```
compatibility = 0.65 × inboundCoverage + 0.35 × outboundCoverage
```

Inbound is weighted higher because the person reading the screen is looking for a
teacher. Outbound still counts, because a partner who also gains something is far more
likely to say yes.

### The exchange bonus

When **both** directions are non-empty, compatibility is multiplied by
`MATCH_EXCHANGE_BONUS` (default **1.25**) and clamped to 1:

```
if (inbound.length > 0 && outbound.length > 0)
    compatibility = min(1, compatibility × 1.25)
```

This single line is what makes the platform a *skill exchange* rather than a tutor
directory. Worked example — I teach Python and want Figma:

| Candidate | Teaches | Wants | inbound | outbound | Raw | Bonus | Final |
|---|---|---|---|---|---|---|---|
| Reciprocal | Figma | Python | 1.0 | 1.0 | 1.00 | ×1.25 | **1.00** |
| One-way | Figma | Guitar | 1.0 | 0.0 | 0.65 | — | **0.65** |

Both teach exactly what I want, equally well. The reciprocal candidate wins by 35 points
of skill score, which flows through to roughly 14 points of final score at a 40% weight.

### Degenerate cases

- I list no learning goals → judge purely on outbound (what they gain from me).
- They list no learning goals → judge purely on inbound (what I gain).
- Neither lists anything to learn → score 0. There is no exchange to describe.

---

## 2. Availability overlap — 20%

Weekly availability slots (`{ day, start, end }`) are projected onto a single
0–10079-minute timeline, merged to remove double counting, and intersected:

```
score = overlapMinutes / min(myTotalMinutes, theirTotalMinutes)
```

Dividing by the **smaller** total is deliberate. A student free four hours a week whose
entire four hours overlap with a partner's twenty scores 1.0 — they can always meet.
Dividing by the larger total would punish them for being busy.

**Empty calendars score 0.5, not 0.** An unfilled form is missing data, not a scheduling
conflict. Scoring it zero would bury every new user before they ever completed onboarding.

Merging matters: a student listing "Mon 09:00–11:00" and "Mon 10:00–12:00" is credited
with three hours, not four.

---

## 3. Experience fit — 15%

For each inbound pairing, how well does the teacher's level serve the learner's target?
`diff = rank(teacher) − rank(desired)`, over BEGINNER(1) → EXPERT(4):

| diff | Score | Reasoning |
|---|---|---|
| ≥ +3 | 0.85 | Expert teaching a beginner: capable, but often forgets what is hard |
| +2 | 0.95 | Very good |
| **+1** | **1.00** | **Ideal — near enough to remember the difficulty, far enough to have answers** |
| 0 | 0.80 | Peer level: workable, limited headroom |
| −1 | 0.40 | Teacher below target: real penalty |
| ≤ −2 | 0.00 | Cannot teach what they do not know |

The curve peaks at +1 rather than at maximum expertise. That is the
[expert blind spot](https://en.wikipedia.org/wiki/Curse_of_knowledge) — the person one
step ahead is frequently the better teacher.

The component is the mean across all inbound pairings, falling back to outbound if the
viewer gains nothing, and to a neutral 0.5 if there are no pairings at all.

---

## 4. Rating — 15%

A raw average is unusable at low volume: one 5-star review would outrank a 4.8 across
forty. So the rating is a **Bayesian average** against a prior of 3.5 stars carrying the
weight of 3 reviews:

```
adjusted = (3 × 3.5 + Σratings) / (3 + count)
```

An unrated student sits at 3.5 — neither punished for being new nor rewarded for having
no track record. As reviews accumulate, the prior washes out. The result is mapped to
`[0, 1]` by `(adjusted − 1) / 4`.

---

## 5. Location — 10%

Distance only matters if the pair would ever meet in person, so mode compatibility is
checked first (each student is `ONLINE`, `OFFLINE`, or `BOTH`):

- **No shared mode** (online-only vs in-person-only) → **0**. They cannot meet at all.
- **Only online shared** → **1.0**. Distance is irrelevant; a partner across the world is
  as good as one next door.
- **Offline possible** → distance decides:
  - Same college → 1.0
  - Both have coordinates → `1 − distance/MAX_DISTANCE_KM`, floored at **0.15**
  - Same city → 0.7
  - Unknown → 0.5

The 0.15 floor rather than 0 keeps a distant-but-reachable partner visible when nobody
closer teaches the skill. Distance is great-circle (haversine).

**Privacy:** coordinates are never returned by the API. Only the city label and derived
distances are exposed — enforced by explicit serialisation in
[`users/serializer.ts`](../server/src/modules/users/serializer.ts) and asserted by a test.

---

## Explainability

Every result carries `reasons[]` — machine-readable codes (`TWO_WAY_EXCHANGE`,
`TEACHES_WHAT_YOU_WANT`, `SAME_COLLEGE`, …) that the client renders as sentences, plus
the full per-component `breakdown`.

A percentage with no explanation reads as arbitrary. Showing *why* also makes the system
debuggable: if a match looks wrong, the breakdown says which component caused it.

---

## Why a pure function

`scoring.ts` has no database access, no clock, and no I/O. Everything arrives as a
`MatchProfile`. That has three consequences:

1. **It is exhaustively testable.** 44 unit tests cover every component, boundary and
   degenerate case with no fixtures or database.
2. **It is reviewable.** The whole algorithm is one file you can read top to bottom.
3. **It can move.** Running it in a scheduled job instead of per-request needs no change
   to the function itself.

The database work lives separately in
[`matching/service.ts`](../server/src/modules/matching/service.ts), which handles
candidate generation and hydration.

---

## Complexity and scaling

Per request:

1. **Candidate generation** — an indexed query on `UserSkill (skill, type)` for people
   who sit on either side of a skill overlap. This is the selective step; it does not
   scan the user collection.
2. **Scoring** — `O(candidates × skills)` in application memory, capped at
   `CANDIDATE_CAP = 500`.
3. **Hydration** — one query resolving skill names for the returned page only.

At the scale this targets (a college, or a handful) the candidate set after skill
filtering is far below the cap. The cap exists to stop a pathological profile — someone
listing thirty popular skills — from turning one request into a full scan.

**Beyond that scale**, the same pure function moves to a scheduled job that writes a
precomputed `Match` collection, and the endpoint becomes an indexed read. Nothing in
`scoring.ts` changes.

---

## Tuning the weights

All six parameters are environment variables, so they can be tuned without a code change:

```bash
MATCH_W_SKILL=0.45          # must sum to 1.0 with the other four
MATCH_W_AVAILABILITY=0.15
MATCH_W_EXPERIENCE=0.15
MATCH_W_RATING=0.15
MATCH_W_LOCATION=0.10
MATCH_EXCHANGE_BONUS=1.30   # 1.0 disables the exchange preference entirely
MATCH_MAX_DISTANCE_KM=25
```

A reasonable evaluation, given real usage data, would be to measure **request acceptance
rate** by match score decile. If high-scoring matches are not accepted more often than
low-scoring ones, the weights are wrong. Setting `MATCH_EXCHANGE_BONUS=1.0` and comparing
acceptance rates is a clean A/B test of the project's central hypothesis: that reciprocal
pairings are more likely to actually happen.

---

## Test coverage

| Area | What is asserted |
|---|---|
| `slotsToIntervals` | Day offsetting, overlap merging, adjacency, invalid slot rejection |
| `intersectMinutes` | Disjoint, partial, nested, touching-endpoint cases |
| `availabilityScore` | Full/partial/zero overlap, neutral score for empty calendars |
| `levelPairScore` | Full 4×4 matrix, peak at +1, bounded to [0,1] |
| `bayesianRating` | Prior pull, 40×4.8 beats 1×5.0, convergence at volume |
| `haversineKm` | Identity, a known ~140 km distance |
| `locationScore` | Mode incompatibility, online irrelevance, decay, floor, fallbacks |
| `skillCompatibility` | **The canonical A↔B case**, bonus clamping, priority weighting, asymmetry |
| `computeMatchScore` | Breakdown reproduces the score, reasons fire, reciprocal outranks one-way, empty profiles produce no NaN, never exceeds 1 |

Integration tests in [`matching.test.ts`](../server/tests/integration/matching.test.ts)
verify the same behaviour end to end through the HTTP API, including exclusion of
connected users, suspended accounts, and self-matching.
