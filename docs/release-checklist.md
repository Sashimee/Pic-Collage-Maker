# Release checklist

A release is `dev` merged into `main`. Every push to `main` deploys to GitHub Pages,
so `main` gets only what has already passed on `dev`. Only Alex merges into `main`.

## 1. Before merging `dev` → `main`

- [ ] CI is green on the `dev` head: lint, unit coverage, e2e, build, bundle budget,
      offline, Lighthouse, CodeQL.
- [ ] Lighthouse is green on `dev`. A single 0.74 performance run is runner noise
      (#133); re-run the job before reading anything into it.
- [ ] No open `bug` issue is labelled for this release.
- [ ] `src/lib/changelog.ts` has a `RELEASES` entry for anything a user should
      hear about. Its id changes the "What's new" sheet, so add one only for a
      user-visible change.
- [ ] Every new string is in all six languages (`src/i18n/translations.ts` + `locales/`).
- [ ] Persistence survives a real reload: open a saved project with photos and a
      photo background, reload, and check that the photos and background are
      still there.
- [ ] On a real phone (iOS Safari and Android Chrome), check the four gestures,
      import, and an export through Web Share.
- [ ] Export one PNG, one PDF and one photo book, and open each.

## 2. Ship

- [ ] Open a PR `dev` → `main` and merge it with a merge commit, not a squash, so
      `main` keeps the individual Conventional Commits that release-please reads.
- [ ] Watch `deploy.yml` until Pages is live.
- [ ] Open the live URL and accept the "new version" banner. The build id at the
      bottom of Settings should match the merge commit.

## 3. Tag

- [ ] release-please (`.github/workflows/release.yml`) opens or updates a
      `chore(main): release x.y.z` PR. Review the `CHANGELOG.md` it writes, then
      merge it. That creates the `vX.Y.Z` tag and the GitHub Release.
- [ ] Merge `main` back into `dev` so the version bump and changelog aren't
      reported as conflicts next time.

## If it goes wrong

- Revert on `main` with `git revert <sha>` in a PR and let it deploy. Never
  force-push `main`.
- Users on the broken build get the fix through the service worker's update
  check (`useVersionCheck`) without reinstalling.
