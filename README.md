# Klopt

A study app for Dutch secondary-school students: vocabulary and key terms, practised the way StudyGo and Quizlet do it, plus a daily spaced-repetition queue. It runs entirely in the browser. There are no accounts, no backend, no analytics and no cookies. Everything is stored on the device in IndexedDB, and the app works offline after the first visit. The interface is Dutch or English.

"Klopt" is a working name. It lives only in `src/config.ts` (`APP_NAME`); translations use `{app}`.

## Quick start

```bash
npm install
npx playwright install chromium
npm run dev
npm run check
npm run build
npm run e2e
```

- `npm install` installs the dependencies.
- `npx playwright install chromium` downloads the browser the end-to-end tests use. It's only needed once, before the first `npm run e2e`.
- `npm run dev` starts the app at http://localhost:5173.
- `npm run check` runs the typecheck, lint and unit tests.
- `npm run build` makes the production build in `dist/`.
- `npm run e2e` builds, then runs the Playwright tests against `vite preview`.

`npm run dev` and `npm run build` first copy the on-device OCR engine into `public/ocr/` (see `scripts/copy-ocr.mjs`).

## What's in it

**Lists**
- Two languages per list (Dutch, English, French, German, Spanish, Italian, Latin or "other" for terms).
- A subject badge per list.
- Search and a subject filter.

**Four ways to fill a list**
- **Type it yourself:** a table editor. Enter moves to the next cell, there are accent keys for French, German, Spanish, Italian and Dutch, and you can paste several lines into one cell.
- **Photo of your book:** the text is recognised on the device.
- **Paste:** from Quizlet, Excel or Google Sheets.
- **Shared file:** open a list someone else shared.

**Practice modes**

| Mode | What happens |
|---|---|
| Herhalen (Review) | The daily queue of due cards across all lists: the Leitner boxes. |
| Leren (Learn) | Multiple choice first, then typing. Anything you get wrong comes back a few questions later until you know it. |
| Flashcards | Flip the card and say honestly whether you knew it. What you didn't know comes back at the end. |
| Meerkeuze (Multiple choice) | Four options. |
| Typen (Type) | Type the answer, with hints that reveal letters. Wrong answers come back at the end. |
| Dictee (Dictation) | Hear the foreign word and type it. Only with a voice installed on the device. |
| Toets (Test) | Everything once, no feedback, and a Dutch grade at the end (1 + 9 × score). |

You can practise front to back, back to front, or mixed, with all words or only the difficult ones.

**Checking typed answers** works the way a teacher checks:
- Case, extra spaces and punctuation at the end don't matter.
- Several right answers can be separated with `/`, `;` or `,`. A decimal comma like `1,5` stays intact.
- Anything in brackets is optional: `(de) auto` accepts both `auto` and `de auto`.
- A missing accent or one typo counts as "almost". Swapping two neighbouring letters counts as one typo.
- "Toch goed" (count it as right) overrules the check when your answer really was right.
- Answers longer than 40 characters or 6 words (definitions) are never typed: you flip the card and grade yourself.

**Progress**
- A streak and a daily goal.
- A week strip on the home screen and a 12-week calendar.
- Per list: often wrong, sometimes wrong, mostly right, not practised yet, and how the cards are spread over the Leitner boxes.
- One button to practise all difficult words across lists.

## How the Leitner boxes work

| Box | Comes back after |
|---|---|
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5 | 30 days |

- **Goed** (right) moves a card up one box, at most to box 5.
- **Twijfel** (unsure, which includes "almost" or using a hint) keeps it in its box.
- **Fout** (wrong) sends it back to box 1.

The new due date is today plus the interval of the resulting box.

**Only the first answer to a card on a given day moves it between boxes.** Everything after that the same day, such as practice rounds or repeats in Leren, is still logged but marked `counts: false`. Practising a list ten times in one evening therefore doesn't rush it to box 5.

## Example usage

**Paste a list.** Go to *Lijsten → Nieuwe lijst → Plakken* and paste one word per line, with a tab or semicolon between word and translation:

```
la maison	het huis
le chien;de hond
l'école;de school
```

**Photograph a list.**
1. Go to *Nieuwe lijst → Foto van je boek* and pick the two languages.
2. Take or choose a photo. The first time, the engine is downloaded (about 4 MB, plus 1 to 3 MB per language) from this app's own server. After that it works offline.
3. The words are split into two columns using the empty gap between them, or on a ` - ` or ` = ` in single-column lists.
4. You check the result in the paste screen before anything is added.

**Share a list.** Open a list and choose *Delen*. Small lists get a link like `…/#/deel/H4sIAAAA…`: the words are gzipped and base64url-encoded into the URL fragment, which is never sent to a server. Bigger lists are shared as a file. The receiver sees a preview first, and progress is never shared.

**Back up.** *Instellingen → Back-up downloaden* saves `klopt-backup-YYYY-MM-DD.json`. Restoring validates the file, then merges it with what's there or replaces everything (after a confirmation). Version 1 files are still accepted.

## Project layout

```
src/
  config.ts            APP_NAME, limits
  lib/
    dates.ts           YYYY-MM-DD helpers on Date.UTC (DST-safe)
    scheduler.ts       Leitner step; answerCard() with the first-answer-of-the-day rule
    practice.ts        practice engine for all modes (pure, seedable)
    answer.ts          typed-answer checking, hints
    history.ts         difficulty, cache rebuild from the log, streak
    session.ts         the daily review queue
    db.ts              the only IndexedDB module (schema v2, migration from v1)
    backup.ts          backup and share format, strict validation (v1 and v2)
    share.ts           share-link codec with an inflate cap
    importText.ts      tab and semicolon parser
    ocr.ts, ocrRows.ts on-device OCR and column reconstruction
    speech.ts          pronunciation with on-device voices only
    router.ts          hash routes
    app.svelte.ts      app state
  i18n/nl.ts, en.ts    messages; en is typed against nl
  routes/, components/ Svelte 5 screens
  styles/tokens.css    design tokens (values and sources in DESIGN-RECON.md)
tests/unit/            Vitest
tests/e2e/             Playwright
```

## Data model

- `Deck`: name, subject, `langFront`, `langBack`.
- `Card`: text, box, and a `due` local date. It also holds caches rebuilt from the log: `hist`, its last 8 results, and `lastDay`.
- `Review`: an append-only log with `at`, local `day`, `grade`, `fromBox`, `toBox`, `mode` and `counts`.
- `DayStat`: answers per day, a cache for the streak and daily goal.

A card's box and due date can always be recomputed by replaying its reviews where `counts` is true; a unit test does exactly that. The caches are rebuilt from the log after every restore or merge.

## Security and privacy

- **No requests except to the app's own origin.** The fonts, the OCR engine and its language data are all served by the app itself. Pronunciation only uses voices installed on the device (`localService`), so no text reaches a speech server.
- **CSP in production:**
  - `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'`, with no third-party origins.
  - `'wasm-unsafe-eval'` is needed to compile the OCR engine's WebAssembly. It doesn't allow JavaScript `eval` or `new Function`; `'unsafe-eval'` and `'unsafe-inline'` are not set.
  - `dist/_headers` adds `frame-ancestors 'none'`, `nosniff` and `no-referrer` for Netlify and Cloudflare Pages.
- **User text is never rendered as HTML.** ESLint fails on `{@html}`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` and `new Function`.
- **Everything received is validated field by field.** That covers imports, backups and share links: types, enums, real dates, UUIDs, lengths, counts, references, review consistency and unknown keys. Sizes are capped before parsing, and gzip inflation is capped too.
- **No source maps in production.** Source-map comments are stripped from the copied OCR files as well.

## How it's tested

**Unit tests (Vitest, 183 tests, run with `TZ=Europe/Amsterdam`)**
- **Scheduler:** your four table cases, every box × grade × day of 2026 against the reference implementation, DST, and the first-answer-of-the-day rule.
- **Dates:** rollover and DST.
- **Answer checking:** alternatives, optional brackets, accents, typos including swapped letters, decimal commas, hints.
- **Practice engine:** every mode, Leren repeating missed words until known, the Dutch grade, fallbacks for too few answers, direction, dictation needing a voice.
- **Streak:** across months, years and DST.
- **OCR:** reconstructing columns, wrapped lines, skew, dash-separated lists.
- **Database** (on `fake-indexeddb`): the v1 to v2 migration, the day stats, replaying the log, cache rebuilds on restore.
- **Backup:** round trip, more than 25 kinds of malformed input rejected, v1 files still accepted.
- **Share links:** gzip bomb, invalid UTF-8.
- **Router and i18n parity.**

**End-to-end tests (Playwright, 13 tests, production build)**
- **Learn:** make a list in the table editor, then learn it by keyboard only (multiple choice, then typing, one mistake that comes back). Check the boxes, the difficulty groups and the streak, then reload and go offline.
- **Review:** the daily queue by keyboard, typing the short answers and self-grading the long ones.
- **Test:** a Dutch grade of 6,6 from two right, one typo and one wrong.
- **Photo:** a real image of a two-column list goes through the on-device OCR.
- **Import and backup:** paste, back up, wipe, restore, merge, and the language switch.
- **Sharing:** share by link and a damaged link refused. Also the backup reminder.
- **Accessibility:** axe WCAG 2.2 AA on 17 screen states in light and dark at 360px, plus 44px tap targets, no horizontal scroll (also with very long words), and reduced motion.
- **Security:** the CSP blocks inline script and third-party fetches, and HTML in words and list names shows as text.

The flow tests also fail on any request to another origin, any CSP violation and any console error.

The design was measured against StudyGo, Quizlet and Duolingo and then re-measured on this build; see [DESIGN-RECON.md](DESIGN-RECON.md).
