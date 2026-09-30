# Handoff: Klopt

**Stopped because the usage limit was reached, 2026-09-30.** Everything below is committed and green: `npm run check` (212 unit tests) and `npm run e2e` (19 Playwright tests).

## State

v2 is a StudyGo-style study app, bright blue, local-first. See `README.md` and `DESIGN-RECON.md`.

Built this session, after the v2 redesign:
- **Lists:** duplicate, export as text (TSV), share via the phone's share sheet, sort, and paste with spreadsheet quotes.
- **Practice:** choose 10, 20 or all words, starred words, lenient accents and typos (settings), sounds and vibration, swipe for flashcards, and a speaker in the answer sheet.
- **Koppelen:** a matching game with rounds, a timer and a record per list.
- **Test date per list:** a fixed daily plan, upcoming tests on the home screen, and a 7-day forecast on Voortgang.
- **Continue where you left off:** after closing the app, with a "Verder met…" card on the home screen.
- **Share target:** text shared from another Android app lands in the paste screen.
- **Also:** a keyboard shortcuts panel, the version number in Settings, a UUID fallback for plain-http LAN testing, and a day rollover while the app stays open.

## Not done yet (next steps, in order)

1. **Deploy:** add `.github/workflows/deploy.yml` for GitHub Pages, or document Netlify/Cloudflare Pages. Publishing needs Valentijn's OK and his accounts.
2. **Screenshot and design pass on the new screens:** Koppelen, the test plan card, the resume prompt, the continue card, and the keyboard shortcuts. Check both themes, 360px and desktop 1440px. Re-run the design-recon audit (the extractor in `~/.claude/skills/design-recon/scripts`).
3. **Accessibility test:** extend `tests/e2e/a11y.spec.ts` to the new screens (Koppelen, the resume prompt, the exam card, the forecast).
4. **E2E test for the share target:** open `/?text=…`, check that the paste screen is prefilled and the query is stripped.
5. **Docs:** update `README.md` (new features and test counts) and `docs/screens`.
6. **Ideas not started:** folders per school subject, a dark-mode check of the subject badge colours, and a print view of a list.

## How to verify

```bash
npm run check
npm run e2e
```

Screenshots: `node scripts/screens.mjs docs/screens 390`.
