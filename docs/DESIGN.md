# Design system: mobile app

How the Skill Exchange app looks, moves and feels, and the rules that keep it that way. The
research behind these choices is in [DESIGN-RESEARCH.md](DESIGN-RESEARCH.md). The values live in
code (`mobile/src/theme/index.ts`, `mobile/src/haptics/`), so this page explains *why*, and
the code is the source of truth for exact numbers.

## The idea

**The interface should feel physical.** Buttons are raised and press down onto a lip. Things
move on springs, not timers. Every meaningful moment has a matching feel in the hand, and the
feel is choreographed with the motion, not fired at random. The two biggest moments in the app,
seeing how well you match someone and connecting with them, are designed as events.

## Colour carries meaning

Each accent colour means one thing, everywhere. If a colour appears, it is saying that thing.

| Colour | Means | Where |
|---|---|---|
| Violet (`primary`) | Teach, and the brand | Skills you teach, primary buttons, active tab |
| Orange (`learn`) | Learn | Skills you want, "You learn" labels |
| Green (`success`) | Success, and two-way match | Accept buttons, two-way ribbons and rings, ticks |
| Red (`danger`) | Destructive or error | Delete, block, error banners |

Light and dark palettes are both complete, and every text-on-fill pair passes WCAG AA (4.5:1),
checked by script. Text on a coloured fill uses `onPrimary` / `onSuccess` / `onDanger`, never a
hard-coded white, because the dark palette's fills are light.

## Type

Plus Jakarta Sans, five weights, one font file per weight. A weight is chosen by *family*
(`fontForWeight`), never by `fontWeight` on its own, because Android fakes bold when the family
lacks the weight. The `Text` component in `components/Text.tsx` does this mapping, so screens
can still write `fontWeight: '700'`.

| Style | Size / line height | Use |
|---|---|---|
| display | 34/40 extrabold | One per screen, at most: onboarding, celebration |
| title | 26/32 extrabold | Tab screen titles, profile names |
| heading | 18/24 bold | Section headers, card titles |
| body | 16/24 | Reading text. Never smaller than 16 for paragraphs |
| caption | 12.5/17 medium | Metadata. The floor is 11 |

Numbers that change (scores, stats) use tabular figures so they do not jitter while counting.

## Space, shape, depth

- Spacing steps: 2, 4, 8, 12, 16, 20 (page gutter), 24, 32, 48.
- Radii: 10, 14, 20, 28, and pill. Cards use 20.
- Touch targets are at least 44 points, without relying on hit slop.
- **Raised buttons**: the face sits 4 points (3 for small) above a darker lip of the same shape.
  Pressing pushes the face down onto it. Use at most one raised primary button per view;
  everything else is tonal (soft fill) or ghost.
- Shadows are tinted with the ink colour rather than black in light mode. In dark mode they are
  black and stronger, and depth also comes from lighter surfaces (a raised control is lighter
  than the track it sits on).

## Motion

Springs, from Material 3 Expressive's physics model:

| Spring | Use |
|---|---|
| `spatialFast` | Small things: chip pops, tab pill, segmented thumb |
| `spatial` | Cards and list rows arriving |
| `spatialSlow` | Large surfaces |
| `bouncy` | Celebration pieces, star pops, tab icon bounce |
| `pressSpring` | A button face going down |

Rules:

- **Spatial springs may overshoot; effects never do.** Position and scale can bounce. Colour and
  opacity use timed curves, because an overshooting colour flickers.
- Frequent interactions take 100 to 300 ms. Lists stagger by 40 ms, capped at six items.
- Loading states are skeletons shaped like the real layout, not spinners on an empty screen.
- Under Reduce Motion, nothing loops or travels: skeletons hold still, floating chips stop, the
  celebration shows its final frame, and the haptic falls back to a single success.

## Haptics

Screens never call the device. They ask for a *meaning* (`haptics.success()`), and
`mobile/src/haptics/` decides what the phone does. Patterns are data: timed lists of
primitives (`tick`, `tap`, `press`, `click`, `thud`, `confirm`, `reject` and so on), so changing
how something feels is a one-line edit in `patterns.ts`.

### Engines

- **Android, "Crisp" (default)**: the system's own haptic constants
  (`performAndroidHapticsAsync`), with fallbacks by API level. These are short, sharp clicks
  tuned by the phone's maker. The older impact/notification calls are buzzy waveforms on most
  Android phones, which is why they are not the default.
- **Android, "Strong"**: drives the vibration motor directly, for phones whose system effects
  are weak or missing.
- **iOS**: the Taptic Engine's impact, selection and notification generators.
- React Native's `Vibration` API is never used.

### Levels

Settings → Haptics offers **Off**, **Subtle** and **Full**. Subtle plays only events that carry a
message (success, error, a new message, a connection). Full adds *detail*: the texture ticks that
accompany motion, such as a score filling up. Two patterns can overlap; detail events give way
inside a minimum gap (45 ms, or 90 ms on the Strong engine), and anything that carries a message
always plays. All patterns stop when the app goes to the background.

### Vocabulary

| Meaning | Feels like | Used for |
|---|---|---|
| `keyDown` / `keyUp` | A key going down, then a softer return | Every raised button |
| `selection` | The lightest notch | Tabs, chips, segments, password rules ticking over |
| `tap` | A light tap | Opening a card or row |
| `toggle(on)` | The system switch feel | Checkboxes |
| `refresh` | A latch catching | Pull to refresh committing |
| `success` / `error` / `warn` | Platform notification patterns | Results, banners |
| `reject` | A dull thud | Declining, withdrawing, removing |
| `sent` | Click, then confirm 140 ms later | Request sent, session scheduled, report filed |
| `messageSent` / `messageReceived` | A release / a tick and tap | Chat |
| `starRating(n)` | Ticks left to right, landing harder for more stars | Review stars, in step with their pop |
| `achievement` | A rising run ending in confirm | Account created, review submitted, session completed together |
| `scoreReveal(score)` | Ticks that slow down with the ring's easing, then a landing | The match ring on a student's profile |
| `connection()` | Three quickening taps, a thud, a confirm | Accepting a request |

### Choreography

The two hero patterns are timed to their animations, beat for beat.

- **Score reveal** (`ScoreRing felt`, 900 ms): a tick is placed at each step of the count-up,
  using the inverse of the ring's ease-out curve, so the ticks spread apart exactly as the arc
  slows. Ticks closer than the previous gap are dropped, so the rhythm only ever slows. Under 55
  lands with a tap, 55 to 79 with a click, 80 and up with a confirm; a two-way match adds a thud
  before the landing. Only one ring per screen is felt: the one the person came to see.
- **Connection** (`ConnectionCelebration`): taps at 0, 130 and 260 ms as the two avatars are
  drawn together on an accelerating curve; a thud at 420 ms, the instant they touch and the
  burst goes off; the confirmation at 640 ms as the title lands.

## Components

All in `mobile/src/components/`. Screens should be built from these, not from raw React Native
views with inline colours.

- **Foundations**: `Text`, `Screen`, `Display` / `Title` / `Heading` / `Subheading` / `Body` /
  `Caption` / `Overline`.
- **Actions**: `Button` (primary, success, danger, secondary, inverse, tonal, ghost; lg / md /
  sm), `IconButton`, `TextButton`, `PressableScale`.
- **Input**: `Field`, `Input` (filled well, border on focus or error), `PasswordInput`,
  `Checkbox`, `Chip`, `Segmented`, `StarPicker`.
- **Content**: `Card`, `ListRow`, `IconTile`, `Avatar` (colour is stable per name),
  `StatTile` (counts up), `ProgressBar`, `ScoreRing`, `ScoreBar`, `Banner`, `EmptyState`,
  `ErrorView`, skeletons.
- **Layout**: `ScreenHeader`, `SectionHeader`, `BottomBar` (main action pinned under the thumb),
  `Row`, `Divider`.
- **Domain cards** (`cards.tsx`): `MatchCard`, `MatchPeek`, `StudentCard`, `SessionCard`,
  `RequestCard`, `CalendarEntryCard`.
- **Moments**: `ConnectionCelebration`, the custom `TabBar` (labelled tabs, a pill that slides to
  the active one).

## Signature screens

- **Onboarding**: one screen, not a carousel. Teach and learn skills float around the app's mark,
  introducing the violet/orange meaning before a word is read. Account creation comes after.
- **Home**: a "next up" card on the brand gradient that changes with the student's situation
  (add skills, answer requests, the next session, or explore), stats, shortcuts, and a "For you"
  carousel of matches that bleeds off the screen edge.
- **Student profile**: the felt score ring, a verdict in words, a trade card showing what flows
  each way, the score's working, and the main action pinned to the bottom.
- **Requests**: Accept is green and raised; accepting plays the connection celebration and offers
  to open the chat.
- **Chat**: the partner in the header, grouped bubbles with one timestamp per run, day
  separators, a live typing bubble, and one-tap starters for the first message.
- **Settings → Haptics**: the level control, the Android engine choice, and "Feel it" buttons that
  play each pattern, so the setting is chosen by feel.

## Adding a screen

1. Start from `Screen`. Tab roots use `ScreenHeader`; stack screens let the native header carry
   the title and do not repeat it.
2. Use the kit's typography and colour tokens. If a colour means teach, learn, success or danger,
   use that token, and do not use it for anything else.
3. Loading: a skeleton shaped like the screen. Empty: `EmptyState` with the one action that fills
   it. Error: `ErrorView` with retry.
4. Give every action a result haptic from the vocabulary above. If none fits, add a pattern to
   `patterns.ts` rather than calling a primitive from the screen.
5. Check it at phone width in both light and dark mode, and with Reduce Motion on.
