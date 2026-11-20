# Design system: mobile app

How the Skill Exchange app looks, moves and feels, and the rules that keep it that way. The
research behind these choices is in [DESIGN-RESEARCH.md](DESIGN-RESEARCH.md). The values live in
code (`mobile/src/theme/palette.ts` and `index.ts`, `mobile/src/haptics/`), so this page explains *why*, and
the code is the source of truth for exact numbers.

## The idea

**The interface should feel physical.** Buttons are raised and press down onto a lip. Things
move on springs, not timers. Every meaningful moment has a matching feel in the hand, and the
feel is choreographed with the motion, not fired at random. The two biggest moments in the app,
seeing how well you match someone and connecting with them, are designed as events.

## Colour

### Principles

Colour is applied by **role**, never by value. Every colour comes from
[`mobile/src/theme/palette.ts`](../mobile/src/theme/palette.ts), so a screen asks for
`primary` or `textSecondary` and never for a hex code. The roles follow Material 3's colour
system, the platform guidance this was built from:

- **Restraint.** Most of every screen is neutral surface. Vivid colour is kept for the one
  action that matters on a screen and for information. A raised primary button is usually the
  only saturated thing in view.
- **One meaning per colour**, everywhere (Apple: "avoid using the same color to mean different
  things"):

  | Colour | Means |
  |---|---|
  | Indigo (`primary`) | The brand, main actions, links, progress, and **teach** |
  | Teal (`tertiary`) | **Learn**, and nothing else |
  | Green (`success`) | Success, accepted, **two-way match** |
  | Amber (`warning`) | Warnings and pending |
  | Red (`error`) | Errors and destructive actions only. A declined request is neutral, not red |
  | Gold (`reward`) | Stars, streaks, points, badges |

- **Never colour alone** (WCAG 1.4.1). Teach and learn also differ by icon (school and book),
  selected chips and segments show a tick, the active tab's icon fills in, unread rows turn bold,
  medals keep their numbers, and every error comes with words.
- **Pairs, not guesses.** Text on a fill always uses that fill's `on…` role (`onPrimary` on
  `primary`, `onTertiaryContainer` on `tertiaryContainer`), which is what guarantees contrast.
- **Selection** uses `secondaryContainer`, as Material's filter chips, segmented buttons and
  navigation bar do, so a selected choice never competes with the main button.
- **Two outline strengths.** `outline` (3:1 or better) draws boundaries that identify a control:
  text fields, checkboxes, empty stars. `border` is for decorative hairlines and dividers only.
- **No gradients, no pure white or black.** Flat role colours only. Light surfaces are a
  near-white `#FDFCFF` on a cool grey page; the dark page is `#121316`, not black.
- **Light and dark are designed separately**, not inverted. In dark mode accents move to light
  tones with dark text on them, and surfaces get lighter as they come forward (Apple's base and
  elevated backgrounds), so depth survives where shadows do not.

### How the palette is built

The palette is generated, not hand-picked, with Material Color Utilities (the library behind
Material 3's tonal palettes). A few key colours, each a hue and chroma in the HCT colour space,
become tonal palettes from tone 0 (black) to 100 (white). Each role then takes a fixed tone,
using Material 3's assignments: accents at 40 in light and 80 in dark, on-accent at 100 and 20,
containers at 90 and 30, on-containers at 30 and 90.

- **Brand: indigo**, hue 284 at chroma 52. The same family as the original violet, but calmer
  (the old violet was chroma 73) so it reads as trustworthy rather than loud.
- **Secondary: the same hue at chroma 14.** A monochromatic support colour for selection and
  tonal buttons, so the UI does not gain a second loud hue.
- **Tertiary: teal**, hue 198 at chroma 26. A cool accent that sits well apart from indigo and
  stays clearly bluer than the success green. It is deliberately less saturated than the brand,
  so it never outshines it (Material's guidance for secondary and tertiary accents).
- **Neutrals: hue 256 at chroma 4 and 8.** A trace of blue, so surfaces look cool and clean
  beside the indigo rather than warm or grey.
- **Semantic colours**: green (150), amber (52), red (25), gold (84), each at a chroma that keeps
  its container tones soft.

To change the scheme, edit `KEYS` in `mobile/scripts/generate-palette.mjs` and follow the
instructions at the top of that file.

### Tokens

**Surfaces and text**

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F4F3F7` | `#121316` | Screen background, behind everything. |
| `surface` | `#FDFCFF` | `#1E2022` | Cards, sheets, bars. One step forward from the background (lighter in both themes). |
| `surfaceContainer` | `#EBEAEE` | `#292A2D` | Wells inside a surface: tracks, resting chips, segmented controls. |
| `surfaceContainerHigh` | `#E3E2E6` | `#38393C` | The most raised neutral: a selected thumb on a dark track, pressed rows. |
| `textPrimary` | `#1A1C1E` | `#E8E8EB` | Main readable content. |
| `textSecondary` | `#5A5F66` | `#B2B6BF` | Supporting text, captions and placeholders. 4.5:1 or better on every surface. |
| `border` | `#D9DDE6` | `#353940` | Hairlines and dividers. Decorative only: never the sole outline of a control. |
| `outline` | `#787C84` | `#888C94` | Boundaries that identify a control: inputs, checkboxes, empty stars. 3:1 or better. |

**Brand and accents**

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#5054B1` | `#C0C1FF` | The brand. Main buttons, links, active states, progress, and "teach". |
| `onPrimary` | `#FFFFFF` | `#1F2181` | Text and icons on primary. |
| `primaryContainer` | `#E1E0FF` | `#383B98` | Soft brand fill: the next-up card, teach chips. |
| `onPrimaryContainer` | `#383B98` | `#E1E0FF` | Text and icons on primaryContainer. |
| `secondaryContainer` | `#E2E0F6` | `#454556` | Selected states: chips, segments, the active tab, tonal buttons. |
| `onSecondaryContainer` | `#454556` | `#E2E0F6` | Text and icons on secondaryContainer. |
| `tertiary` | `#326667` | `#9BD0D0` | The contrasting accent, used for one meaning only: "learn". |
| `tertiaryContainer` | `#B7ECED` | `#164E4F` | Learn chips and tiles. |
| `onTertiaryContainer` | `#164E4F` | `#B7ECED` | Text and icons on tertiaryContainer. |

**States**

| Token | Light | Dark | Use |
|---|---|---|---|
| `success` | `#266B35` | `#8FD795` | Success, accepted, and two-way matches. |
| `successContainer` | `#AAF4AF` | `#035320` | Soft success fill. |
| `warning` | `#974800` | `#FFB688` | Warnings and pending states. |
| `warningContainer` | `#FFDBC7` | `#733600` | Soft warning fill. |
| `error` | `#B12C25` | `#FFB4AB` | Errors and destructive actions. |
| `errorContainer` | `#FFDAD6` | `#8F1011` | Soft error fill. |
| `reward` | `#A67A00` | `#FDBB04` | Stars, streaks, points and badges. A graphic colour (3:1), not for small text. |
| `rewardContainer` | `#FFE5B8` | `#5C4200` | Soft reward fill. |

The full set (46 tokens, including raised-button lips and medal colours) is in `palette.ts`,
each with the palette and tone it came from.

### Accessibility check

`npm run check:contrast` (in `mobile/`) tests every colour pairing the app uses, in both
themes, and CI runs it on every push. It checks 50 pairs per theme:

- **4.5:1** for all text, including secondary text, placeholders, links and every `on…`
  pairing (WCAG 1.4.3). Apple asks for at least 4.5:1, and most body text here clears 12:1.
- **3:1** for what identifies a control or its state: field and checkbox outlines, filled and
  empty stars, progress fills against their tracks, the selected-segment tick, and medals
  (WCAG 1.4.11).
- That no large surface is pure white or pure black.

Ratios are not rounded: 4.49 fails 4.5.

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
- Shadows use the `shadow` role and are soft in light mode. In dark mode depth comes mainly
  from lighter surfaces: a card is lighter than the page it sits on.

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
| `arrival(kind)` | Its main beat lands with the banner, 160 ms in | A notification banner arriving (see Notifications) |

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

## Notifications

Sources: Apple HIG "Notifications" and "Managing notifications", Android's "Notifications"
design guide, Nielsen Norman Group's "Five Mistakes in Designing Mobile Push
Notifications". The code is in `mobile/src/notifications/` and
`server/src/modules/notifications/`.

### Words

Every notification is written on the server, so these rules live there.

- **Who, then what.** When a person caused it, their name is the title and the body says
  what they did: "Priya Nair" / "Wants to learn Figma from you." Events lead with the event:
  "JavaScript session booked" / "Priya Nair booked Sat 21 Nov, 5:00 pm · At Library".
- Titles stay under about 30 characters (Android truncates them to one line). The body
  never repeats the title. Sentence case, no app name, and no instructions ("Confirm it
  to…"): say what happened, and let tapping take them there.
- **Times are in the reader's time zone**, written absolutely ("Sat 21 Nov, 5:00 pm"),
  because the same text stays in the notification centre, where "tomorrow" would go stale.
  The phone reports its zone when it registers for push.
- People's own words are quoted, clipped at a word: a request's message, a review's comment,
  a cancellation reason.
- Ratings are written as words ("5 stars"), not ★ symbols, which screen readers read out
  as "black star".
- A declined request is never pushed and never bannered. It waits quietly in the centre.

### On the phone (push)

Six categories, each an Android channel with its own name in the phone's settings:

| Category | Importance | Vibration (echoes the in-app haptic) | iOS level |
|---|---|---|---|
| Messages | High (pops up) | Two light knocks | Active |
| Requests | High | Knock, knock, a firmer beat | Active |
| Session reminders | High | Three even beats | Time-sensitive |
| Session changes | Default (sound only) | One pulse | Active |
| Reviews and badges | Low (silent) | None | Passive |
| Account and safety | Default | Two pulses | Active |

- The status-bar icon is a white symbol for the category (chat bubble, person-add, alarm,
  calendar, trophy) from the app's own Ionicons, with the app's mark for account notices,
  tinted the brand indigo. Drawn by `assets/source/generate_art.py notifications`.
- **No floods.** A chat keeps one notification on Android (each new message replaces it)
  and one stack on iOS. Updates to a session replace each other. A reminder expires when its
  session starts.
- **No stale ones.** Opening a chat clears its notifications from the tray; "Clear all" in
  the centre clears the tray and the badge. The app icon's badge is the unread count.
- A channel's vibration cannot change once a phone has created it. Changing one means a
  new channel id.

### In the app (the banner)

While the app is open the system banner is switched off and the app draws its own: a card
that drops in from the top on the `spatial` spring, with the person's face (or the event's
tinted icon) and a small badge for the kind of event, the title and two lines of body.

- Tap opens what it is about. Swipe up dismisses; pulling down gives a little and springs
  back. It leaves by itself after 4.5 s (5.5 s for long text, 10 s with a screen reader).
- A newer notification replaces it in place with a small nod, never a stack.
- **Never for what is already on screen** (Apple's Mail example): no message banner inside
  that chat or on the chat list, no request banner on Requests, nothing on the notification
  centre itself.
- The categories switched off in Settings stay quiet here too.
- Reduce Motion: it fades instead of travelling. It is announced to screen readers.

### Asking permission

Never at launch. The app asks after a moment whose follow-up is worth hearing about:
sending a request, connecting (after the celebration), booking a session. A sheet shows two
notifications exactly as they would arrive, with the real person's name and skill, says
what will come ("Never ads"), then hands over to the system prompt. "Not now" is respected:
at most three asks, a week apart, and none once the system prompt is refused for good.

### Settings → Notifications

Whether this phone gets them (with "Turn on" or "Open settings" when it does not), then a
switch per category. Account notices always arrive. The switches are stored on the server,
so they follow the student to every phone.

## Components

All in `mobile/src/components/`. Screens should be built from these, not from raw React Native
views with inline colours.

- **Foundations**: `Text`, `Screen`, `Display` / `Title` / `Heading` / `Subheading` / `Body` /
  `Caption` / `Overline`.
- **Actions**: `Button` (primary, success, danger, secondary, tonal, ghost; lg / md /
  sm), `IconButton`, `TextButton`, `PressableScale`.
- **Input**: `Field`, `Input` (filled well, border on focus or error), `PasswordInput`,
  `Checkbox`, `Switch` (Material 3: the thumb grows and shows a tick when on), `Chip`,
  `Segmented`, `StarPicker`.
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
  introducing the indigo/teal meaning (and the school/book icons) before a word is read. Account creation comes after.
- **Home**: a "next up" card on a soft brand container that changes with the student's situation
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
