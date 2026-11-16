# UI redesign: research notes

Working notes for the mobile app redesign (flagship-level UI, choreographed haptics). Written
on 16 November 2026, before the design was drawn. The design that came out of them is
documented in [DESIGN.md](DESIGN.md).

## Sources: what was read

| # | Source | Status |
|---|---|---|
| 1 | Mobbin | Landing page only. Its library returned 403 (bot protection) on every page, including ones linked from its own homepage. Needs Akshit's signed-in browser. |
| 2 | Page Flows | Read: homepage, Duolingo Android onboarding flow (timeline public, screens paywalled after the first three), iOS onboarding gallery. |
| 3 | Screenlane | Redirects to pageflows.com. No longer a separate site. |
| 4 | Dribbble | Read: skill-swap and peer-learning shots. "DUORIE" (light, violet): match-percentage badges on each person, tabs For you / Most compatible / Nearby, and two chip rows per person, Teaches and Wants to learn. "Skill Swap" (dark magenta and orange). |
| 5 | Behance | Read: "SkillSwap" case study (navy, a credits economy, full wireframes for onboarding, matching and chat). The search page reports 403 but renders; images viewed from the CDN. |
| 6 | Apple HIG | Read: Playing haptics, Motion, Layout, Typography, Feedback, Onboarding, Tab bars, Loading, Color, Accessibility. |
| 7 | Material Design 3 | Read: motion physics (how it works, specs), M3 Expressive overview. |
| 8 | Figma Community | Visited. File previews are behind sign-in, so only titles and covers were visible: nothing usable beyond confirming the common patterns above. |
| 9 | Laws of UX | Read: all 30 laws. |
| 10 | NN/g | Read: animation duration, microinteractions, skeleton screens, mobile onboarding, touch targets, empty states. |
| + | Android haptics design principles (developer.android.com) | Read. Not on the list, but decisive for haptics on Android. |

## Haptics: what the guidance says

Apple (HIG, Playing haptics):
- Use system patterns for their documented meaning: success, warning, error; impact light, medium,
  heavy, rigid, soft; selection for values that are changing.
- Build a consistent cause-and-effect vocabulary. The same pattern must never mean two things.
- Match the intensity and sharpness of a haptic to the animation it accompanies.
- Prefer short haptics on discrete events. Avoid overuse: the best haptics are missed when off,
  not noticed when on.
- Make haptics optional.

Android (haptics design principles):
- Prefer clear and rich haptics over buzzy ones. Given buzzy or nothing, choose nothing.
- Avoid legacy one-shot vibration (`Vibrator.vibrate(long)` and pattern arrays). In React Native
  that is the `Vibration` API, so it must not be used.
- Use action-oriented `HapticFeedbackConstants`. In Expo that is
  `Haptics.performAndroidHapticsAsync(AndroidHaptics.*)`; confirm the enum in expo-haptics 15.
- Rich haptics can be made by sequencing clear primitives at varied strengths and intervals.
- Correlate strength with importance and frequency: frequent events very subtle, important events
  stronger. Effects can grow stronger as an interaction approaches its target.
- Haptics out of sync with visuals feel broken. Co-design them with the animation.

Decision: a haptics engine that plays named patterns, each a timed sequence of system primitives,
scheduled against the animation it belongs to. No raw vibration. A setting to turn haptics off
(and likely a "subtle" level). Patterns must be cancelable, and throttled so ticks cannot spam.

Candidate vocabulary (to finalise): press-down and release on buttons; selection tick for tabs,
chips, toggles; score reveal (ticks that strengthen as the ring fills, then a landing thud scaled
to the score); star rating (each star stronger); connection made (the hero celebration); send and
receive message; success, warning, error; pull-to-refresh threshold; long-press build-up.

## Motion

Material 3 Expressive (May 2025) replaced easing-and-duration with springs:
- Spatial springs (position, size, rotation, corner radius) overshoot and settle.
- Effects springs (colour, opacity) never overshoot.
- Three speeds each: fast for small components, default, slow for full-screen.
- Published curve equivalents: spatial 350 / 500 / 650 ms; effects 150 / 200 / 300 ms.
- Reanimated mapping to try: spatial fast dampingRatio 0.6, default 0.8, slow 0.8; effects 1.0.

NN/g: most animation 100 to 500 ms. Simple feedback about 100 ms. Larger changes 200 to 300 ms.
500 ms already feels like a drag. Ease-out by default. Entrances slightly longer than exits. The
more frequent the animation, the shorter and subtler.

Apple: motion must be purposeful, brief, cancelable and optional. Respect Reduce Motion. Avoid
adding motion to interactions that happen constantly.

## Layout, type, colour

- Body text 17pt default, 11pt minimum. Avoid light weights. Use as few typefaces as possible.
- Contrast 4.5:1 for text up to 17pt, 3:1 for 18pt and up or bold.
- Touch targets at least 1cm x 1cm (about 48dp), with space between them.
- One colour, one meaning. Supply light and dark variants for every colour.
- Hierarchy through size, weight and colour; group with space and containers; progressive
  disclosure over dense screens.
- M3 Expressive tactics: varied shapes, rich colour for hierarchy, emphasised type, containment,
  springy motion, and one or two hero moments per product (brief, delightful, tied to the key
  interaction). For this app: the match score reveal, and the moment two students connect.

## Onboarding, loading, empty states

- Duolingo's flow (Page Flows): Get started, then one question per screen, then a real lesson,
  lesson complete, rewards, streak, and only then create profile (age, name, email, password).
  Value first, account last. Welcome screen is a mascot, one line, and two chunky stacked buttons
  in the thumb zone.
- Apple and NN/g agree: onboarding should be fast, interactive and skippable; teach in context
  rather than with a slide deck; postpone setup that is not essential.
- Loading: show something at once. Skeletons must mimic the real layout, not just the frame.
- Empty states: say what the state is, teach what goes here, and give a direct next step.
- Tab bars: navigation only, always visible, labelled, badges only for critical information.

## Laws of UX that matter most here

Doherty Threshold (respond within 400 ms), Fitts's Law (big targets, in the thumb zone), Hick's
Law (fewer choices per screen), Jakob's Law (behave like apps people already know), Peak-End Rule
(make the peak and the ending feel good), Goal-Gradient (show progress toward a goal),
Von Restorff (one element stands out per screen), Zeigarnik (surface unfinished tasks, such as an
incomplete profile), Aesthetic-Usability Effect, Miller's Law and Chunking.

## What the visual sources changed

- Every skill-swap concept shows *both directions* per person (teaches / wants to learn). The
  app now gives those two directions fixed colours, violet and orange, everywhere.
- Match percentage is the headline on every person in DUORIE. The score ring leads each match
  card, and on the student profile it is felt as well as seen.
- None of the concepts show *why* two people match. The profile's trade card and score
  breakdown are where this app goes further than its references.

## Status

The redesign described in DESIGN.md is built. What remains can only be done on a phone: the
haptics must be feel-tested on a real build (Settings → Haptics → "Feel it" plays each one).
Mobbin was never readable without Akshit's sign-in.
