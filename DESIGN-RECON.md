# Design recon: Klopt v3

**Design read:** a mobile-first study app for Dutch secondary-school students, in StudyGo's visual language: a bright band, white cards, chunky green buttons, yellow callouts, coloured round icons. Clearly its own app, in blue.
**Measured:** 2026-09-30, all sites at 1440×900 with the design-recon extractor. Raw digests are in the session scratchpad (`recon/*.json`).

**Direction:**
- **v2** (bright blue, measured tokens, no illustrations) was rejected by Valentijn as too plain: on his phone it opened in dark mode and read as a generic dashboard.
- For **v3** he chose between two rendered mockups in StudyGo's real visual language, one in StudyGo purple and one in blue. He picked **blue**.

## References

| Site | Role | Final URL | Why |
|---|---|---|---|
| StudyGo | locked (named by the user) | studygo.com/nl/ and /oefenen/functies/woordjes-leren/ | Visual language: brand band, white cards, knob buttons, yellow accents, subject icons, the practice flow |
| Quizlet | direct peer | quizlet.com/nl | Mode tiles, the set page, a calm and dense app type |
| Duolingo | disagreeing craft benchmark | duolingo.com | Streak and week dots, one loud button style, 3D press |

## Type

One family: **Figtree** (variable, self-hosted), a friendly geometric grotesk close to StudyGo's ModernEra.

| Role | Size | Weight | Source |
|---|---|---|---|
| Hero number (due count, grade) | 64px | 800 | Duolingo and StudyGo stat numbers |
| Page title in the band | 40px (28px on phones) | 800 | StudyGo display 44/800 |
| H1 | 28px | 800 | StudyGo H2 32/800 |
| H2 | 20px | 700–800 | Quizlet 20 |
| Green button label | 19px | 800 | StudyGo button 18/700; 19px keeps white on green legal as large text |
| Lead | 17px | 700 | StudyGo button label |
| Body | 16px | 400 | |
| Small | 14px | 400 / 700 | StudyGo 14–15, Quizlet 14 |
| Caption | 13px | 700 | Quizlet 12, Duolingo 15/700 |

- **Weights:** 3 (400, 700, 800).
- **Sizes:** 10 across the app, including the 22px wordmark, and 5 to 9 per screen.

## Color

| Role | Light | Dark | Source |
|---|---|---|---|
| Brand band (header, page titles, browser bar) | `#1660FF` | `#1447C9` | Valentijn's blue in StudyGo's band pattern |
| Page ground | `#F3F6FC` | `#0F1422` | StudyGo ground `#faf9fa`, shifted to blue |
| Card | `#FFFFFF` | `#171D2E` | |
| Primary button (green knob) | `#16A34A` on a `#0F7A35` edge | same | StudyGo's green "Start" knob |
| Yellow (callouts, streak, test dates) | `#FFD43B` / soft `#FFF6D1` | `#CAA52A` / `#3A3312` | StudyGo's yellow highlights |
| Round icons (subjects, modes) | eight hues, `--ic-1` … `--ic-8` | same | StudyGo's coloured subject icons |
| Text | `#131A2E` / secondary `#56607A` | `#EEF1F8` / `#A7B0C8` | |

Contrast, all measured with the WCAG formula:
- **Band:** white on the band is 5.06:1 (7.57:1 in dark). Chips and tiles on the band use the darker `--band-2` (6.23:1). No text on the band is translucent.
- **Green:** white on green is 3.30:1, which only passes as large bold text. Every green button is therefore 19px/800, including the large ones (a test caught one that wasn't).
- **Yellow:** ink on yellow is 12.13:1. On yellow and white surfaces that stay light in dark mode, text uses the fixed `--on-light` tokens.
- **Round icons:** white on the eight icon hues is 4.60 to 5.93:1.
- **Text on the ground:** 15.97:1, and secondary text 5.79:1.

## Space

- **Base unit:** 4px (82–90% of measured values align).
- **Rhythm:** 16px between cards and 24–32px between sections.
- **Container:** 1040px for list screens and 640–720px for practice and settings.

## Surface

- **Radii:** 10px (small keys and cells), 14px (inputs, tiles, options), 24px (cards, callouts, sheets), and pill for every button, chip and segmented option. StudyGo uses 8/24/pill.
- **Shadows:**
  - one card shadow: `0 2px 0` plus `0 10px 28px` at 8% ink
  - the knob edge, `0 var(--edge-size) 0 var(--edge-color)`, one recipe coloured per button variant (grey, green, red)
- **Press:** buttons move down by the edge and the edge disappears, as with StudyGo's knob.

## Composition

- **Band with a wave:** the header continues into a full-width blue band that carries the page title and ends in a soft wave. On home, progress and settings the first card lifts onto the wave.
- **Home:**
  - in the band: a greeting, a white streak chip with a flame, the daily-goal line and a week of dots
  - below: the "Herhalen" card with an illustration and a green Start knob
  - then tests as yellow callouts, recently practised lists, and subject tiles with round icons
- **List page:**
  - in the band: the subject icon, title, meta chips, and Edit, Share and Copy tiles
  - below: a due card with an illustration, a yellow "set a test date" callout, and mode tiles with a coloured round icon each ("Leren" marked *Aanbevolen*)
  - then progress and the words
- **Practice:** a white card with a header row (mode icon and name, star), a large prompt, and green knob actions. After checking, the green or red feedback sheet slides up. That sheet is the one signature motion.
- **Illustrations:** four small original stickers (cards, trophy, stack, camera), with ink outlines and bright fills on a themed backdrop circle.

## Motion

- **Base:** 180ms `cubic-bezier(0.2, 0.8, 0.2, 1)` for every state change; the button press takes 110ms.
- **Signature:** the answer sheet, 260ms, `translateY(12px → 0)` plus opacity.
- **Reduced motion:** with `prefers-reduced-motion`, changes are instant.

## Deliberate divergences

1. **Blue, not purple, and nothing of StudyGo's.** No logo, mascot, illustrations or copy is taken from StudyGo; the illustrations are drawn for Klopt.
2. **Light by default.** Dark stays a choice in the settings. Installs from before v3 that simply followed the system theme move to light once.
3. **The Leitner "Herhalen" queue is the home hero.** StudyGo has no daily spaced-repetition queue.
4. **Subject icons are a symbol or two letters** (€, π, `</>`, Fr), not a clip-art set.

## Audit (v3)

Measured on the production build with the same extractor at 1440×900, on the home, list, practice and settings screens.

| Metric | References (median) | Target | Build | Verdict |
|---|---|---|---|---|
| Font families | 1 | 1 | 1 | pass |
| Font weights | 3 | 3 | 3 (400, 700, 800) | pass (first pass: 4, a stray 600; fixed) |
| Distinct sizes per screen | 8 | ≤ 10 | 5–9 | pass |
| Body size / line-height | 16 / 1.5 | 16 / 1.5 | 16 / 1.5 | pass |
| Text colour roles | 7.5 | ≤ 8 | 4–7 | pass |
| Distinct radii | 5.5 | ≤ 5 | 3–4 | pass |
| Shadows per screen | 2.5 | ≤ 3 | 2–4 | the one knob-edge recipe counts once per colour; settings shows grey, green and red buttons |
| Space base alignment | 4px @ 74% | ≥ 70% | 4px @ 82–90% | pass |
| Container max-width | 1148 | 1040 | 1040 | pass |
| Easing and duration | ease-out, 0.12–0.25s | 180ms, one curve | 180ms `cubic-bezier(0.2, 0.8, 0.2, 1)`, one curve | pass |
| Looping animations | 0 | 0 | 0 | pass |
| Signature effects | 1 | 1 | 1 (answer sheet) | pass |
| Reduced motion respected | | required | yes | pass |
| Contrast (axe, WCAG 2.2 AA) | | 0 violations | 0 on 21 phone states × 2 themes and 5 laptop screens × 2 themes | pass |
