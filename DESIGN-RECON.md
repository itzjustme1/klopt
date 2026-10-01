# Design recon: Klopt v4

**Design read:** the structure of the real StudyGo app, in navy. It should be compact, flat and friendly, with rows instead of decorated cards, one green action per screen and as little helper text as possible.

**How we got here:**
- **v2** used measured tokens on a light page. Valentijn found it plain.
- **v3** copied StudyGo's *marketing site*: a blue band, sticker illustrations and coloured icon circles. He called it "nog steeds AI slop".
- **v4** is built on the logged-in **StudyGo app** itself, which he opened for this (read-only, nothing changed in his account). From two rendered mockups he picked dark navy over light.

## What the StudyGo app actually does (measured 2026-10-01, 691px wide)

| Thing | StudyGo app | Klopt v4 |
|---|---|---|
| Ground / surfaces | `#240E3E` / `#3D1868`, plus white at 5% | `#0B1736` / `#14295A` / `#1C3570` |
| Primary button | green `#29B966` pill, dark text, darker bottom edge | `#29B966`, text `#08200F` (6.7:1), edge `#1A8048` |
| Type | ModernEra, 14px body, 18px/900 headings, weights 500/700/900 | Gabarito, 15px body, 18 and 24px/900, weights 500/700/900 |
| Radii | 8, 16, 24 and circles | 8, 12, 16, 20 and pills |
| Shadows | essentially none | none on surfaces; only the button edge and the bottom-sheet shadow |
| Navigation | a bottom tab bar (Home, Oefenen, Nieuw, Zoeken, Meer) | Vandaag, Lijsten, a green **Nieuw**, Voortgang, Instellingen; a sidebar on laptops |
| Home | search pill, streak flame, "Jouw items" chips, "Jouw vakken" chips with flags, Recent | the same, plus the blue "Herhalen" block (Klopt's own spaced-repetition queue) and Toetsen rows |
| List page | centred title, breadcrumb, "Wanneer is je toets?", one green "Oefen alle woorden", "Origineel" direction, word rows with speaker and a select circle | the same, with stars and a status dot per word |
| Practice menu | bottom sheet "Oefen met": plain rows, line icons, a yellow AANBEVOLEN label | the same |
| Create | "Nieuw" sheet: Lijst, Quiz, Map…; quizzes mix multiple choice, fill-ins, open and dictation | Woordenlijst, Begrippenlijst, Quiz, Foto, Plakken, Gedeeld bestand; quizzes: multiple choice, fill in, open, true or false |

## Colour and contrast

All measured with the WCAG formula.

| Pair | Ratio |
|---|---|
| White on ground / surface / raised | 17.7 / 14.1 / 11.7 |
| Secondary text `#A9B9DF` on ground / surface / raised | 9.0 / 7.2 / 6.0 |
| Accent `#7FA8FF` on ground / surface / raised | 7.5 / 6.0 / 5.0 |
| Dark text on green | 6.7 |
| Dark text on the yellow label | 12.2 |
| White on the blue review block `#1F5CFF` | 5.2 |
| Navy text on the eight subject colours | 4.8 to 8.2 |

The light theme uses the same structure on `#F2F5FB` with white surfaces and keeps the same ratios as v3.

## Deliberate divergences

1. **Navy, not purple.** Nothing of StudyGo's identity is reused: no logo, mascot, illustrations, font or copy.
2. **No illustrations at all.** StudyGo has them in empty states; Klopt keeps those screens text-only.
3. **The Herhalen block stays on top of home.** StudyGo has no daily spaced-repetition queue.
4. **Subject marks:** a round flag for a language, otherwise a coloured circle with a symbol (€, π, `</>`) or a letter.

## Audit (v4)

Measured on the production build with the design-recon extractor at 1440×900, on the home, list, practice and settings screens.

| Metric | Target | Build | Verdict |
|---|---|---|---|
| Font families | 1 | 1 (Gabarito) | pass |
| Font weights | 3 | 3 (500, 700, 900), as in StudyGo | pass |
| Distinct sizes per screen | ≤ 10 | 5–7 | pass |
| Text colour roles | ≤ 8 | 4–7 | pass |
| Distinct radii | ≤ 5 | 4 | pass |
| Shadows per screen | ≤ 3 | 0–3 (button edges and a sheet) | pass |
| Space base alignment | ≥ 70% | 4px @ 67–88% | just under on three screens. The 6 and 10px gaps in rows and chips follow StudyGo, which measures 63% itself. |
| Easing | one curve | 180ms `cubic-bezier(0.2, 0.8, 0.2, 1)` | pass |
| Looping animations | 0 | 0 | pass |
| Reduced motion respected | required | yes | pass |
| Contrast (axe, WCAG 2.2 AA) | 0 violations | 0 on 27 phone states × 2 themes and 5 laptop screens × 2 themes | pass |
