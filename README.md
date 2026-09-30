# Klopt

A flashcard trainer for Dutch exam subjects (Economie, Bedrijfseconomie, Informatica), using the Leitner box method. It runs entirely in the browser: no accounts, no backend, no analytics, no cookies. Everything is stored on the device in IndexedDB, and the app works offline after the first visit. The interface is Dutch or English.

"Klopt" is a working name. It lives only in `src/config.ts` (`APP_NAME`); translations use `{app}`.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + unit tests
npm run build      # production build in dist/
npm run e2e        # builds, then runs the Playwright tests against `vite preview`
```

The first `npm run e2e` needs a browser: `npx playwright install chromium`.

## How the Leitner boxes work

| Box | Comes back after |
|---|---|
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5 | 30 days |

- **Goed** (key 3): the card moves up one box (at most box 5).
- **Twijfel** (key 2): the card stays in its box.
- **Fout** (key 1): the card goes back to box 1.

The new due date is today plus the interval of the box the card ends up in. New cards start in box 1 and are due today. A session holds every card due today or earlier, lowest box first, shuffled within each box. In a session, Space (or a tap) flips the card and 1, 2, 3 grade it.

## Example usage

**Import a list.** Go to *Importeren* and paste one card per line, with a tab or semicolon between term and definition. Copying two columns from Excel or Google Sheets gives you tabs; so does Quizlet's export.

```
inflatie	stijging van het algemeen prijspeil
dekkingsbijdrage;verkoopprijs min de variabele kosten per product
stack;LIFO; last in, first out
```

The third line becomes front `stack`, back `LIFO; last in, first out`, because only the first semicolon splits (a tab always wins over semicolons). Blank lines are ignored. A line without a separator is skipped and reported, for example: *Regel 5 overgeslagen. Zet een tab of puntkomma tussen term en uitleg.* Limits: 2000 cards and 2000 characters per side per import.

**Back up and restore.** *Instellingen → Back-up downloaden* saves `klopt-backup-YYYY-MM-DD.json`. *Back-up terugzetten* validates the file, shows what's in it, then lets you merge (adds new decks and cards; the newer version of a card wins) or replace everything (asks for confirmation first).

**Share a deck.** Open a deck and choose *Delen*. Small decks get a link like `https://…/#/deel/H4sIAAAA…`. The deck is gzipped and base64url-encoded into the URL fragment, which browsers never send to a server. Decks that would make a link longer than about 8000 characters are shared as a file instead. Whoever opens the link or file sees a preview first and decides whether to add it. Shared decks never include progress.

## Project layout

```
src/
  config.ts            APP_NAME, limits
  lib/
    dates.ts           YYYY-MM-DD helpers, Date.UTC arithmetic (DST-safe)
    scheduler.ts       DAYS and review(): pure Leitner step
    session.ts         buildSession(): due cards, box order, shuffle
    db.ts              the only IndexedDB module (via idb)
    importText.ts      tab/semicolon parser
    backup.ts          backup/share file format and strict validation
    share.ts           gzip + base64url link codec with an inflate cap
    router.ts          hash routes (#/, #/overhoren, #/stapels, #/importeren, #/instellingen, #/deel/…)
    app.svelte.ts      app state
  i18n/nl.ts, en.ts    messages; en is typed against nl, so a missing key fails typecheck
  routes/, components/ Svelte 5 screens and parts
  styles/              tokens (light + dark), base, index card
tests/unit/            Vitest
tests/e2e/             Playwright
scripts/               icon rendering and screenshots (dev only)
```

## Data model

`Deck`, `Card` (with `box` and a `due` local date `YYYY-MM-DD`), and an append-only `Review` log (`at` ISO timestamp, `day` local date, `grade`, `fromBox`, `toBox`). A card's `box` and `due` can always be recomputed by replaying its reviews through `review()`, so the algorithm can change later without losing history. There is a unit test that does exactly this. Deleting a card or deck also deletes its reviews. `topic` exists on cards for per-topic progress later.

## Security and privacy

- No runtime requests except the app's own files. Fonts are bundled with `@fontsource`.
- Strict CSP: a `<meta>` tag in production (`script-src 'self'; style-src 'self'`, no `unsafe-inline`, no `unsafe-eval`, no third-party origins). The build also writes `dist/_headers` with the same policy plus `frame-ancestors 'none'`, `nosniff` and `no-referrer`, for Netlify and Cloudflare Pages.
- User text is never rendered as HTML. ESLint fails on `{@html}`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` and `new Function`.
- Imports, backups and share links are validated field by field (types, enums, real calendar dates, UUIDs, lengths, counts, references, review consistency, unknown keys) with size caps before parsing and a cap on gzip inflation.
- No source maps in production.

## Deploying

`dist/` is a static site that works from any path (`base: "./"`). The hash router means no server rewrites are needed. Every static host works. Netlify and Cloudflare Pages will also apply `_headers`. Once there's a real domain, add `robots.txt`, a canonical URL and an `og:image`.

## How it's tested

**Unit tests (Vitest, 123 tests, run with `TZ=Europe/Amsterdam`)**
- **Scheduler:** the four cases from the brief, every box × grade × day of 2026 against the reference implementation, box 5 `goed` repeated, and DST.
- **Dates:** month, year and leap-year rollover, both 2026 DST changes, a 730-day walk, and local vs UTC day.
- **Session builder:** due filter, box order, shuffling.
- **Database** (on `fake-indexeddb`): CRUD, cascading deletes, grading in one transaction, replaying the log to the stored state, merge and replace, reopening.
- **Import parser:** tab, semicolon, blank lines, missing separator, empty side, HTML kept as text, duplicates, oversize.
- **Backup:** export then import round trip, plus more than 20 kinds of malformed input rejected with the failing field named.
- **Share links:** round trip, too long, garbage, a gzip bomb, invalid UTF-8.
- **i18n:** identical keys and placeholders in NL and EN, no em dashes, no hardcoded app name, plurals.
- **Router.**

**End-to-end tests (Playwright, 9 tests, against the production build)**
- **Main flow:** create a deck with three cards, review with the keyboard only, check each card's box and due date, reload, go offline and reopen.
- **Import and backup:** import, download a backup, typed wipe, rejected corrupt file, replace, merge, language switch.
- **Sharing:** share by link and add, damaged link refused. Backup reminder after 50 cards.
- **Accessibility (axe-core, WCAG 2.2 AA):** every screen in light and dark at 360px, plus checks for no horizontal scroll, tap targets of at least 44px, and reduced motion.
- **Security:** the CSP blocks inline script and third-party fetches, and HTML in cards and deck names shows as text.

The flow tests (main flow, import and backup, sharing) also fail on any request to another origin, any CSP violation and any console error.
