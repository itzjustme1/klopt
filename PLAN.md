# Klopt: build plan

Status: v1 built (checkpoints 1 to 5). The questions in section 7 were not answered; the recommended defaults were used (see "Answers used").

## 1. Approach

Static single-page app: Vite 8 + Svelte 5 (runes) + TypeScript strict, hash router, IndexedDB behind one module, `vite-plugin-pwa` for manifest and service worker. No runtime network access beyond the app's own files. Pure logic (dates, scheduler, session builder, import parser, backup/share validation) lives in plain TypeScript with no browser APIs where possible, so it is unit-testable in Node. Svelte components stay thin.

I agree with the stack in the brief. No changes proposed. Verified today: Node 26, npm 11, Vite 8.3, Svelte 5.57, `vite-plugin-pwa` 1.3 (supports Vite 8), and all four `@fontsource` packages exist.

## 2. Dependencies

Runtime: `svelte`, `idb` (about 1.2 KB, gives typed transactions and promise wrappers; raw IndexedDB would cost more code than the dependency), `workbox-window` (pulled in by the PWA plugin for the update prompt), four `@fontsource` packages (Latin subset only, only the weights used).

Dev: `vite`, `@sveltejs/vite-plugin-svelte`, `typescript`, `svelte-check`, `vite-plugin-pwa`, `vitest`, `fake-indexeddb` (DB tests in Node), `@playwright/test`, `eslint` + `typescript-eslint` + `eslint-plugin-svelte`, `prettier` + `prettier-plugin-svelte`.

No router library, no i18n library, no state library, no UI kit, no icon pack.

## 3. File layout

```
klopt/
  index.html                 CSP meta tag, no inline script
  vite.config.ts             svelte, pwa (manifest name from APP_NAME), sourcemap: false
  eslint.config.js           svelte/no-at-html-tags: error, bans innerHTML/outerHTML/insertAdjacentHTML/eval/new Function
  playwright.config.ts       runs against `vite preview` of the production build
  public/                    icons (SVG source + PNG sizes), favicon, robots.txt
  src/
    config.ts                APP_NAME, limits (import, share link, backup size), DAYS lives in scheduler
    main.ts                  mount, theme + lang bootstrap, SW registration
    App.svelte               shell, nav, router outlet, update/install banners
    lib/
      dates.ts               today(), addDays(), diffDays(), isValidDay(), formatDay() (Intl)
      scheduler.ts           DAYS, review(), pure
      session.ts             buildSession(cards, today, rng), pure
      db.ts                  the only file that touches IndexedDB
      importText.ts          parser for tab/semicolon text, pure
      backup.ts              export format, validate(), merge/replace plan, pure
      share.ts               gzip + base64url encode/decode, validate, size check
      router.svelte.ts       tiny hash router ($state)
      store.svelte.ts        app state: settings, decks, due counts
      persist.ts             navigator.storage.persist(), install-hint detection
    i18n/
      keys.ts                message shape
      nl.ts, en.ts           both typed against the shape
      index.svelte.ts        t(), plural(), current lang ($state), sets <html lang>
    styles/
      tokens.css             light + dark tokens, color-scheme
      base.css               reset, fonts, focus rings, reduced motion
      card.css               the index-card look
    routes/
      Today.svelte  Review.svelte  Decks.svelte  Deck.svelte
      Import.svelte  Settings.svelte  ShareReceive.svelte
    components/
      IndexCard.svelte  BoxBar.svelte  BoxRow.svelte  ConfirmInline.svelte  ...
  tests/
    unit/*.test.ts           Vitest
    e2e/review.spec.ts       Playwright
  README.md  PLAN.md
```

Scripts: `npm run check` = `svelte-check` (typecheck) + `eslint` + `vitest run`. `npm run build`, `npm run e2e`.

## 4. Decisions I made (tell me if you disagree)

**Dates and scheduling**
- `dates.ts` works only on `YYYY-MM-DD` strings. `addDays` parses year/month/day, uses `Date.UTC`, formats back with `getUTC*`. `today()` reads local `getFullYear/getMonth/getDate`. Tests run with `TZ=Europe/Amsterdam` forced in the Vitest config so the DST cases are real, plus the pure `addDays` tests are timezone-independent anyway.
- "Today" is recomputed when the app regains focus (`visibilitychange`), so a tab left open past midnight shows the right due count.
- Session: due on or before today, sorted by box ascending, Fisher-Yates shuffle inside each box with an injectable RNG for tests. Wrong cards are not repeated within the same session; they come back tomorrow, as the brief says.
- Each grade is written to the DB immediately (card update + review append in one transaction). Leaving mid-session loses nothing; reopening builds a fresh session from what is still due.

**Review log**
- Append-only store, never updated. See question Q2 for one field I want to add.
- Deleting a card or deck also deletes its reviews (see Q3).

**Data and settings**
- IndexedDB stores: `decks`, `cards` (index on `deckId`, index on `due`), `reviews` (index on `cardId`), `meta` (single settings record). Schema version 1 with an `upgrade()` path so later migrations have a place to go.
- `Settings` gets extra fields the brief implies but doesn't list: `changesSinceExport`, `lastExportAt`, `persistRequested`, `installHintDismissed`. They are local bookkeeping and are not included in backups.
- UI language default: `navigator.language` starting with `en` gives English, everything else gives Dutch.
- Editing a card's text keeps its box and due date.

**Import**
- Per line: if it contains a tab, split on the first tab; otherwise split on the first semicolon. Tab wins because definitions often contain semicolons. Both sides trimmed. Blank lines ignored silently. Missing separator, empty side, or a side over 2000 characters: line skipped with its line number and a specific reason.
- Over 2000 recognised cards: the import button is disabled with an explanation. Raw paste is also capped (about 10 MB) so a huge paste cannot freeze the page.
- Imports go into a chosen existing deck or a new one. Exact duplicates (same front and back already in that deck) are skipped and reported.
- Multi-line spreadsheet cells (quoted, containing newlines) are not supported in v1; each physical line is one card. Card text typed in the editor may contain newlines and renders with `white-space: pre-wrap`.

**Backup and share formats**
- One JSON format: `{ format: "klopt-backup", version: 1, exportedAt, decks, cards, reviews }`. The `format` string is a fixed technical identifier, not the display name, so renaming the app does not break old backups.
- Validation is strict and hand-written (no schema library): exact types, known enum values, `YYYY-MM-DD` validity, UUID shape, string length limits, count limits, no unknown top-level keys, file size cap (proposed 50 MB for backups). Anything off, the whole file is rejected with a message saying what was wrong.
- Merge: records whose id doesn't exist are added; for a card id that exists on both sides the one with the later `updatedAt` wins; reviews are a union by id. Replace: wipes, then writes, in one transaction.
- Shared decks (file or link) contain the deck and its cards only, with no progress and no reviews. On import they get new ids, box 1, due today. A shared deck file is the same format with one deck and an empty `reviews` array.
- Share link: `#/deel/<base64url(gzip(json))>`. The hash router treats `/deel/...` as a route, so it does not conflict. The fragment is never sent to a server. Over 8000 characters, the UI offers the file instead. Decompression output is capped so a crafted link cannot inflate to gigabytes.

**i18n**
- `nl.ts` defines the message object; `en.ts` is typed `Messages` so missing or extra keys are compile errors. Parity test compares key sets at runtime too.
- Placeholders `{app}`, `{n}`, etc. Plurals as `{ one, other }` pairs chosen with `Intl.PluralRules`. Dates via `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`.
- A test fails if any UI string contains an em dash, or the literal app name.
- Hash routes use fixed Dutch slugs (`#/`, `#/overhoren`, `#/decks`, `#/importeren`, `#/instellingen`, `#/deel/...`), independent of UI language, so shared links work for everyone.

**Security**
- CSP via `<meta http-equiv>` so it works on any static host: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. `frame-ancestors` cannot be set in a meta tag; I'll also ship a `_headers`/host config file once we know the host (Q5).
- `style-src 'self'` without `'unsafe-inline'` means I avoid Svelte's built-in `transition:` directives (they inject a `<style>` element) and do motion with CSS classes instead. The e2e test listens for CSP violation reports and fails on any.
- The service worker is registered from a bundled module, not the plugin's inline snippet.
- ESLint bans `{@html}`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`. `build.sourcemap = false`.
- The e2e test records every request and fails if any goes to an origin other than the preview server.

**PWA**
- `registerType: 'prompt'`: a new version shows a small "Nieuwe versie klaar. Vernieuwen" bar instead of auto-reloading, so a review is never interrupted.
- `navigator.storage.persist()` once, after the first deck is created.
- Install hint: on iOS Safari (not standalone) a short text explanation; on Chromium, a button that uses `beforeinstallprompt`. Dismissible, remembered.
- Backup reminder after 50 created or edited cards since the last export. Dismissing it snoozes until another 50.
- Icons: an original mark (an index card with the red header rule and a small check), SVG source plus 192/512/maskable PNGs and a favicon, generated once and committed.

**Design**
- The brief fixes tokens, fonts and card treatment, so I will not run the reference-site recon step. I'll apply the design system as written, then run a final audit pass against your anti-AI-tell list and the pre-launch checklist in checkpoint 5.
- The five box colours have low contrast against the surface in light mode (`--b1` on `--surface` is about 1.3:1). Every bar and box also shows its number as text, so colour is never the only carrier of information.

**Testing**
- Playwright browsers are not installed on this machine. At checkpoint 2 I'll run `npx playwright install chromium` (a download of roughly 150 MB from Playwright's CDN, dev tooling only). If that fails, I'll tell you and fall back to a unit-level flow test.

## 5. Things in the brief I think are wrong or need a call

1. **The review log can't fully reproduce scheduling as specified.** `Review.at` is a UTC timestamp, but scheduling runs on local calendar dates. Replaying the log later needs the local date the review happened on, and a timestamp alone can't give that reliably (travel, timezone changes). Fix: add `day: string` (`YYYY-MM-DD`, local) to `Review`. Cheap now, a migration later. (Q2)
2. **"Scheduling must be derivable from the log" breaks when a card has no reviews but a non-default box.** That happens with backup restore (fine, the log comes along) but also if a future feature ever sets a box directly. I'll keep one rule: `box` and `due` on a card are a cache of (card creation + its reviews). The only writer of `box/due` is the scheduler. Shared decks reset progress, which keeps this rule true.
3. **Red for "Fout" only.** The brief says red appears only where a teacher would use a red pen. I'll use `--accent` for the Fout button outline/label, the header rule and the handwritten note. Goed uses `--good`. Twijfel stays neutral ink. The Start button and other primary actions use ink, not red.
4. **Undo.** A student on a phone will mis-tap a grade. An undo is not in the brief and would conflict with "append-only, never edited" unless it's modelled as a new log entry. (Q4)

## 6. Checkpoints

As in the brief (1 to 5). After each: `npm run check`, `npm run build` (plus `npm run e2e` from checkpoint 2), actual output shown, a commit in the project's own git repo, a short summary of how each part was tested, then stop.

## 7. Open questions

- **Q1. Location.** Project at `~/Downloads/klopt` with its own git repo (created, currently empty). OK, or somewhere else?
- **Q2. Add `day: YYYY-MM-DD` to `Review`?** Recommended yes (see 5.1).
- **Q3. Deleting a card or deck:** delete its reviews too (clean, smaller backups, recommended) or keep orphaned reviews for future statistics?
- **Q4. Undo last grade during a session:** (a) none in v1, (b) undo allowed, recorded as an extra log entry of type `undo` so the log stays append-only, (c) undo that removes the review entry (breaks rule 5 strictly). I'd go with (b) if you want it at all.
- **Q5. Hosting target** (GitHub Pages, Netlify, Cloudflare Pages, not decided yet)? It decides the base path and whether I can add real security headers (`frame-ancestors`, etc.) on top of the meta CSP.
- **Q6. Demo deck:** should the empty state offer "Probeer een voorbeeldstapel" as a secondary action loading the three starter cards (in the UI language), or are they test fixtures only?
- **Q7. Reset confirmation word:** type `WISSEN` (NL) / `DELETE` (EN) to confirm. OK?

## Answers used

- Q1: `~/Downloads/klopt`, own git repo.
- Q2: yes, `Review.day` added.
- Q3: deleting a card or deck deletes its reviews.
- Q4: (a) no undo in v1.
- Q5: undecided. Relative base path `./`, CSP as a meta tag, plus a `public/_headers` file that Netlify and Cloudflare Pages pick up (ignored elsewhere).
- Q6: yes, the empty state offers the sample deck as a secondary action.
- Q7: yes, `WISSEN` / `DELETE`.
- The Dutch UI calls decks "stapels" (a stack of index cards), since "vak" is already the Leitner box.

## v2 (after feedback: "dat ziet er niet uit, kijk af bij studygo.com")

The paper/index-card design and the v1 scope were replaced. Choices made with Valentijn: bright blue as the main colour, and a streak with a daily goal plus photo-to-list on top of StudyGo's practice modes.

Changes to the original brief, on purpose:
- **Design:** the "avoid" list of section 8 (rounded corners, shadows, colour) no longer applies. The measured StudyGo/Quizlet/Duolingo-derived system in `DESIGN-RECON.md` does. No purple, no mascot, and no copied identity or content.
- **Section 11 (out of scope for v1):** the streak, the "lastige kaarten" list and per-list progress are now in, because they were asked for. OCR is in as well, on the device, with no network and no AI service. Accounts, sync, payments and leaderboards are still out.
- **CSP:** `script-src` gains `'wasm-unsafe-eval'`, which the OCR WebAssembly needs. JavaScript `eval` stays blocked, and a test checks that.
- **Scheduling (rule 5 still holds):** only the first answer to a card on a local day moves it between boxes. Every answer is logged with `mode` and `counts`, and the stored state replays exactly from the counting reviews.
- **Data:** schema v2 with an automatic migration from v1, and backup format v2 with v1 files still accepted.
