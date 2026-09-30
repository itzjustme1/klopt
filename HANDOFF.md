# Handoff: Klopt deployment

**Status (2026-09-30):** the app is finished and tested locally: 214 unit tests and 20 Playwright tests, all green. The only thing left is putting it online, which is waiting on one GitHub permission.

## Already done

- The GitHub CLI (`gh`) is installed and logged in as `itzjustme1`. The token has the `repo` scope but not yet `workflow`.
- The repository exists: https://github.com/itzjustme1/klopt (public).
- GitHub Pages is on, with GitHub Actions as the source. The site will be at https://itzjustme1.github.io/klopt/
- The local repo has `origin` set to https://github.com/itzjustme1/klopt.git

## What's blocking

`git push` is rejected because the token lacks the `workflow` scope. Pushes that contain `.github/workflows/deploy.yml` need it.

## To finish

1. Run this, press Enter, then authorize the code in the browser:

   ```bash
   gh auth refresh --hostname github.com --scopes workflow
   ```

2. Push. The workflow runs all tests and then deploys:

   ```bash
   git push -u origin main
   ```

3. Follow the run:

   ```bash
   gh run watch
   ```

4. Open https://itzjustme1.github.io/klopt/ and check that it loads, that there are no console errors, and that it works offline after one visit.

Open question: the commits carry `vbdgrijff@gmail.com`, which becomes public in a public repository. If that isn't wanted, rewrite the author email to the GitHub noreply address before pushing.
