# Klopt

A study app for Dutch secondary-school students: vocabulary and key terms, practised the way StudyGo and Quizlet do it, plus a daily spaced-repetition queue and a plan for your next test. It runs entirely in the browser. There are no accounts, no backend, no analytics and no cookies. Everything is stored on the device in IndexedDB, and the app works offline after the first visit and can be installed to the home screen. The interface is Dutch or English. It looks like StudyGo in blue and is light by default; a dark theme is in the settings.

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
- `npx playwright install chromium` downloads the test browser. It's only needed once, before the first `npm run e2e`.
- `npm run dev` starts the app at http://localhost:5173. Add `-- --host` to open it from a phone on the same wifi.
- `npm run check` runs the typecheck, lint and unit tests.
- `npm run build` makes the production build in `dist/`.
- `npm run e2e` builds, then runs the Playwright tests against `vite preview`.

`npm run dev` and `npm run build` first copy the on-device OCR engine into `public/ocr/` (see `scripts/copy-ocr.mjs`).

## What's in it

**Lists**
- Two languages per list (Dutch, English, French, German, Spanish, Italian, Latin or "other" for terms).
- A subject badge per list.
- An optional test date per list.
- Search, sort and a subject filter across lists; search within a list of more than 20 words.
- Copy, delete and print a list.
- Share a list as a link, a file or through the phone's share sheet; export it as text for Quizlet or Excel.

**Five ways to fill a list**
- **Type it yourself:** a table editor. Enter moves to the next cell, there are accent keys, and you can paste several lines into one cell.
- **Photo of your book:** the text is recognised on the device.
- **Paste:** from Quizlet, Excel or Google Sheets. Tab or semicolon separated, and spreadsheet quotes are handled.
- **Shared file:** open a list someone else shared.
- **From another app:** Android's share sheet sends text straight into the paste screen.

**Practice modes**

| Mode | What happens |
|---|---|
| Herhalen (Review) | The daily queue of due cards across all lists: the Leitner boxes. |
| Leren (Learn) | Multiple choice first, then typing. Anything you get wrong comes back a few questions later until you know it. |
| Flashcards | Flip, then say whether you knew it, or swipe right or left on a phone. What you didn't know comes back at the end. |
| Meerkeuze (Multiple choice) | Four options. |
| Typen (Type) | Type the answer, with hints that reveal letters. Wrong answers come back at the end. |
| Dictee (Dictation) | Hear the foreign word and type it. Only with a voice installed on the device. |
| Toets (Test) | Everything once, no feedback, and a Dutch grade at the end (1 + 9 × score). |
| Koppelen (Match) | Tap words and translations that belong together, against the clock, in rounds of six, with a record per list. |

**Before you start** you choose:
- the direction: front to back, back to front, or mixed
- which words: all, the difficult ones, or starred ones
- how many: 10, 20 or all; the words that need it most are picked first

**While you practise:**
- Leaving halfway is fine: the session continues where you stopped, even after closing the app.
- You can star a word, hear it pronounced, and get sounds and a vibration for right and wrong (you can turn these off).
- On a laptop there are keyboard shortcuts for everything.

**Checking typed answers** works the way a teacher checks:
- Case, extra spaces and punctuation at the end don't matter.
- Several right answers can be separated with `/`, `;` or `,`. A decimal comma like `1,5` stays intact.
- Anything in brackets is optional: `(de) auto` accepts `auto`.
- A missing accent or one typo counts as "almost". Swapping two neighbouring letters counts as one typo. Settings can count both as right.
- "Toch goed" (count it as right) overrules the check.
- Long answers (definitions) are never typed: you flip the card and grade yourself.

**Progress and planning**
- A streak, a daily goal and a 12-week calendar.
- How many cards come back in the next 7 days.
- Per list: often wrong, sometimes wrong, mostly right, and not practised yet, plus the Leitner boxes.
- **A test date per list** turns into a daily plan ("Oefen vandaag 5 woorden"). The target is fixed for the day, and upcoming tests appear on the home screen.

**Help:** *Instellingen → Hoe werkt Klopt?* explains the boxes, the modes, how answers are checked, test planning and your data.

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

**Only the first answer to a card on a given day moves it between boxes.** Everything after that the same day is still logged but marked `counts: false`. Practising a list ten times in one evening therefore doesn't rush it to box 5.

## Example usage

**Paste a list.** *Lijsten → Nieuwe lijst → Plakken*, one word per line:

```
la maison	het huis
le chien;de hond
"to be; to exist";zijn
```

**Plan for a test.**
1. Open a list and choose *Toetsdatum instellen*.
2. Pick the date.
3. The list page and the home screen then show how many words to practise today, with a button that starts Leren with the words you need most.

**Photograph a list.**
1. Go to *Nieuwe lijst → Foto van je boek* and pick the two languages.
2. Take or choose a photo. The first time, the engine is downloaded (about 4 MB, plus 1 to 3 MB per language) from this app's own server. After that it works offline.
3. Check the result in the paste screen before anything is added.

**Share a list.**
- Small lists get a link like `…/#/deel/H4sIAAAA…`: the words are gzipped and base64url-encoded into the URL fragment, which is never sent to a server.
- Bigger lists are shared as a file.
- The receiver sees a preview first. Progress and stars are never shared.

**Back up.** *Instellingen → Back-up downloaden* saves `klopt-backup-YYYY-MM-DD.json`. Restoring validates the file, then merges it with what's there or replaces everything (after a confirmation). Files from version 1 are still accepted.

## Deploying

`dist/` is a static site that works from any path (`base: "./"`) and needs no server rewrites. The app must be served over **https** for offline use and installing to the home screen. On `localhost` that works too, but not on a plain-http network address.

- **GitHub Pages:** push this repository to GitHub and enable Pages with "GitHub Actions" as the source. `.github/workflows/deploy.yml` runs the typecheck, lint, unit tests and all end-to-end tests, and only publishes when everything passes.
- **Netlify:** `netlify.toml` builds `dist/`.
- **Cloudflare Pages:** build command `npm run build`, output `dist`.

Netlify and Cloudflare also apply `dist/_headers`: the CSP plus `frame-ancestors 'none'`, `nosniff` and `no-referrer`. GitHub Pages only gets the CSP meta tag.

## Project layout

```
src/
  config.ts            APP_NAME, limits
  lib/
    dates.ts           YYYY-MM-DD helpers on Date.UTC (DST-safe)
    scheduler.ts       Leitner step; answerCard() with the first-answer-of-the-day rule
    practice.ts        practice engine for all modes, with snapshot and restore
    match.ts           the matching game
    answer.ts          typed-answer checking, hints
    plan.ts            test-date plan and the 7-day forecast
    history.ts         difficulty, cache rebuild from the log, streak
    db.ts              the only IndexedDB module (schema v2, migration from v1)
    backup.ts          backup and share format, strict validation
    share.ts           share-link codec with an inflate cap
    importText.ts      tab, semicolon and quote-aware parser
    ocr.ts, ocrRows.ts on-device OCR and column reconstruction
    speech.ts          pronunciation with on-device voices only
    sounds.ts          WebAudio feedback sounds
    resume.ts          the unfinished session (this browser only)
    router.ts          hash routes
    app.svelte.ts      app state
  i18n/nl.ts, en.ts    messages; en is typed against nl
  routes/, components/ Svelte 5 screens
  styles/tokens.css    design tokens (values and sources in DESIGN-RECON.md)
tests/unit/            Vitest
tests/e2e/             Playwright
scripts/               OCR copy, icon rendering, screenshots
```

## Data model

- `Deck`: name, subject, `langFront`, `langBack`, optional `examDate`.
- `Card`: text, box, a `due` local date, and optional `starred`. It also holds caches rebuilt from the log: `hist` (last results) and `lastDay`.
- `Review`: an append-only log with `at`, local `day`, `grade`, `fromBox`, `toBox`, `mode` and `counts`. Timestamps are kept strictly increasing, so the order is never ambiguous.
- `DayStat`: answers per day, a cache for the streak and daily goal.

A card's box and due date can always be recomputed by replaying its reviews where `counts` is true; a unit test does exactly that.

## Security and privacy

- **No requests except to the app's own origin.** The fonts and the OCR engine with its language data are served by the app itself. Pronunciation only uses voices installed on the device, and the sounds are generated in the browser.
- **CSP in production:**
  - `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'`, with no third-party origins.
  - `'wasm-unsafe-eval'` only allows compiling the OCR engine's WebAssembly. JavaScript `eval` stays blocked, and a test checks that.
- **User text is never rendered as HTML.** ESLint fails on `{@html}`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` and `new Function`.
- **Everything received is validated field by field.** That covers imports, backups, share links and text shared from other apps, with size caps and a cap on gzip inflation.
- **No source maps in production.**

## How it's tested

**Unit tests (Vitest, 215 tests, run with `TZ=Europe/Amsterdam`)**
- **Scheduler:** your four table cases, every box × grade × day of 2026 against the reference implementation, DST, and the first-answer-of-the-day rule.
- **Dates:** rollover and DST.
- **Answer checking:** alternatives, brackets, accents, typos including swapped letters, decimal commas, hints, and the lenient options.
- **Practice engine:** every mode, repeats until known, the grade, session size, and snapshot and restore.
- **Matching game.**
- **Test plan and forecast:** the daily target is fixed for the day.
- **Streak.**
- **OCR columns.**
- **Database** (on `fake-indexeddb`): the migration, the move to the light default, the day stats, stars, strictly ordered logs, replay, cache rebuilds.
- **Backup:** round trip, more than 25 kinds of malformed input rejected, v1 files.
- **Share links:** gzip bomb, invalid UTF-8.
- **Import quoting, the router and i18n parity.**

The unit suite was also run 30 times in a row to rule out flaky tests.

**End-to-end tests (Playwright, 21 tests, production build)**
- **Learn, review and test by keyboard:** checks the boxes, streak, grade, persistence and offline.
- **Session size, starred words, lenient accents, swiping flashcards.**
- **The matching game:** two rounds and a record.
- **A test date:** the plan on the list, home and progress screens.
- **Continuing a session** after a reload.
- **Text shared from another app.**
- **Photo:** a real image goes through the on-device OCR.
- **Import and backup:** paste, back up, wipe, restore, merge.
- **Sharing by link, and the backup reminder.**
- **Accessibility:**
  - axe WCAG 2.2 AA on 21 screen states in light and dark at 360px, and on five screens at laptop width in both themes
  - 44px tap targets
  - no horizontal scroll, also with very long words
  - reduced motion
- **Security:** the CSP and HTML-as-text.

The flow tests also fail on any request to another origin, any CSP violation and any console error.

The design follows StudyGo's visual language in blue. It was measured against StudyGo, Quizlet and Duolingo and then re-measured on this build; see [DESIGN-RECON.md](DESIGN-RECON.md). Screenshots of every screen, light and dark, are in `docs/screens/` (`node scripts/screens.mjs docs/screens` after a build). A 2000-word list imports in about 0.5 s and opens in about 0.3 s on a laptop.
