# Design recon: Klopt v2

**Design read:** a mobile-first study app for Dutch secondary-school students. Friendly, bright and polished, in the language of StudyGo, Quizlet and Duolingo, and clearly its own app.
**Measured:** 2026-09-30, all sites at 1440×900 with the design-recon extractor. Raw digests are in the session scratchpad (`recon/*.json`).
**Direction chosen by Valentijn:** bright blue as the main colour, plus a streak with a daily goal and photo-to-list.

## References

| Site | Role | Final URL | Why |
|---|---|---|---|
| StudyGo | locked (named by the user) | studygo.com/nl/ and /oefenen/functies/woordjes-leren/ | Seven practice modes, the "Leren" flow, the difficult-words overview, the list editor, chunky buttons |
| Quizlet | direct peer | quizlet.com/nl | Mode tiles (Leren, Kaarten, Test, Combineren), dense and calm app type, 4px grid |
| Duolingo | disagreeing craft benchmark | duolingo.com | Extreme restraint on the page, one loud button style, 3D press buttons |

## Type

One family: **Figtree** (variable, self-hosted). It's a geometric grotesk in the same family of shapes as StudyGo's ModernEra and Quizlet's Hurme. All three references use exactly one family.

| Role | Size | Weight | Line-height | Source |
|---|---|---|---|---|
| Prompt / display | 40px (32px on phones) | 800 | 1.15 | StudyGo display 44/800, Quizlet 44/700 |
| H1 | 28px | 800 | 1.2 | StudyGo H2 32/800, Duolingo H1 32/700 |
| H2 | 20px | 700 | 1.3 | Quizlet 20 |
| Body | 16px | 400 | 1.5 | median of StudyGo 18/1.6 and Quizlet 14/1.43 |
| Small | 14px | 400 / 700 | 1.45 | StudyGo 14–15, Quizlet 14 |
| Caption | 13px | 700 | 1.35 | Quizlet 12, Duolingo button labels 15/700 |

- Distinct sizes: **6** (8 counting the phone prompt and the big streak number). Reference median is 8; target ≤ 10.
- Weights: **3** (400, 700, 800). Reference median is 3.
- No tracked-out uppercase labels. Duolingo does it; it's on the tell list.

## Color

| Role | Light | Dark | Source |
|---|---|---|---|
| Page ground | `#F4F6FB` | `#0F1422` | Quizlet surface `#f6f7fb`, StudyGo ground `#faf9fa` |
| Raised surface | `#FFFFFF` | `#171D2E` | all three: white cards |
| Tinted surface (chips, secondary buttons) | `#EDF1F8` | `#212940` | StudyGo chip `#f2f0f5`, shifted towards blue |
| Hairline | `#E1E6F0` | `#2A3350` | StudyGo and Quizlet hairlines |
| Text primary | `#151A2D` | `#EEF1F8` | StudyGo `#19181b`, Quizlet `#282e3e` |
| Text secondary | `#545D78` | `#A7B0C8` | Quizlet `#586380`, StudyGo `#645c70` |
| Accent (bright blue) | `#1660FF` | `#1660FF` | Valentijn's choice. Not Quizlet's `#4255ff` indigo |
| Accent edge (3D press) | `#0A46D1` | `#0A3BB0` | StudyGo knob and Duolingo button edge pattern |
| Accent text (links, text on the tint) | `#1052E6` | `#7FA6FF` | contrast fix: `#1660FF` on the tint is only 4.35:1 |
| Accent tint | `#E6EEFF` | `#1A2A52` | |
| Good / soft | `#0B7A43` / `#E2F6EA` | `#4ADE9A` / `#12301F` | StudyGo green feedback strip |
| Wrong / soft | `#C4261A` / `#FDECEA` | `#FF7A6E` / `#3A1A18` | StudyGo "Vaak fout" red |
| Sometimes wrong / soft | `#B54708` / `#FEF0E1` | `#F5A04A` / `#3A2A12` | StudyGo "Soms fout" orange |

- White on the accent is **5.06:1**, and body text on the ground is **15.95:1**. Secondary text on the ground is 6.04:1. Good, wrong and sometimes-wrong text on their soft backgrounds are 4.80, 5.05 and 4.85:1. The dark-mode accent text is 7.03:1. All measured with the WCAG formula.
- The blue is spent in a few places only: the primary button, progress, the selected state and the home "Herhalen" card. Everything else is white, grey-blue and ink.

## Space

- Base unit: **4px**. Quizlet aligns 85% to it, StudyGo 63%. Target ≥ 70%.
- App rhythm: 24px between blocks and 32–40px between sections. Marketing rhythm (StudyGo 140/140) doesn't apply to app screens.
- Container: 1040px for list screens (Quizlet 1024) and 640px for the practice card (StudyGo's practice card is about 560px).

## Surface

- Radii: **12px** for buttons, inputs and small tiles, **20px** for cards and sheets, **pill** for chips, progress and badges, and a circle for icon buttons. StudyGo uses 8/16/24/pill, Quizlet 4/8/pill, Duolingo 12.
- Shadows, three in total:
  - A card shadow, `0 1px 2px` plus `0 6px 20px` at 6% ink. Quizlet uses `0 4px 16px` at 10%.
  - The primary 3D edge, `0 4px 0` in the accent edge colour, from StudyGo's knob and Duolingo.
  - The secondary edge, `0 3px 0` in a darker hairline.
- Buttons press down: `translateY(4px)` and the edge disappears.

## Motion

- **Base state change:** **180ms** `cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out). StudyGo uses 0.25s ease-out with dominance 8, Quizlet 0.12s. Button press is **110ms** (StudyGo's knob press is 0.12s ease-out).
- **Signature moment (one):** the answer feedback sheet. After checking an answer, a green or red sheet slides up from the bottom of the practice card, with the correct answer and a "Volgende" button.
  - Source: StudyGo's "Correct!" strip and Duolingo's lesson footer. Duration **260ms**, curve `cubic-bezier(0.2, 0.8, 0.2, 1)`, animating `transform: translateY(12px → 0)` and `opacity`. Triggered by Check. No stagger.
- `prefers-reduced-motion`: no slide or flip, instant state changes.

## Composition (from screenshots)

- **Practice screen (StudyGo "Leren"):**
  - A thin progress bar on top with "N te gaan", a green tick count and a red cross count.
  - A centred white card with the prompt in bold and a speaker button next to it.
  - The answer language as a small label, and an input with an underline.
  - An accent-character row for French, German and Spanish.
  - At the bottom, the chunky "Controleer" button next to a grey "Weet ik niet" button.
- **List page (Quizlet set page):** the title and meta first, then a grid of mode tiles, then the word table with a status dot and speaker per row.
- **Subjects (StudyGo chips):** each list carries a subject badge. StudyGo uses a coloured icon; we use a two-letter badge.
- **Results (StudyGo "Bekijk welke woorden je nog lastig vindt"):** groups for Vaak fout, Soms fout and Meestal goed.
- **Mobile collapse:** a bottom tab bar replaces the top nav, and the practice actions stick to the bottom within thumb reach, like Duolingo.

## Deliberate divergences

1. **No purple, no mascot, no illustrations.** StudyGo's identity is purple plus illustration, and copying either makes a knock-off. Klopt uses typography, one blue and simple line icons.
2. **No uppercase button labels.** Duolingo uses them; they're on Valentijn's tell list.
3. **The Leitner "Herhalen" queue stays the home hero.** StudyGo has no daily spaced-repetition queue, and this is what Klopt adds.
4. **Two-letter subject badges instead of subject icons,** to avoid a clip-art icon set.

## Implementation

Tokens live in `src/styles/tokens.css`. Components use the tokens and never raw values, so the audit measures the system rather than one-offs.
