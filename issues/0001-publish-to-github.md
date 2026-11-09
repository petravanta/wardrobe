---
title: Publish Wardrobe to GitHub
status: open
labels: [publishing, blocked]
---

Wardrobe exists only as a local git repo (`main`, no remote) because the `petravanta` GitHub account is under
appeal. Once it is restored, push this repo to a matching `petravanta/wardrobe` project.

Blocked on: the GitHub account appeal.

## Checklist

- [ ] Create an empty public repo `petravanta/wardrobe` (no README, no licence, so the first push doesn't conflict)
- [ ] `git remote add origin https://github.com/petravanta/wardrobe.git`
- [ ] `git push -u origin main`
- [ ] Settings → Pages: deploy from `main`, folder `/ (root)`; confirm https://petravanta.github.io/wardrobe/ loads
- [ ] In the `general` repo: add `wardrobe` to `repos` in `github/apply-ruleset.sh`, run `./github/apply-ruleset.sh wardrobe`
- [ ] In the `general` repo: add the Wardrobe card to `index.html` and the entry to `shared/apps.json`
  (already done in the local `site/general` copy), plus a **Source** link on the card
- [ ] Add `http://localhost:8765` and the Pages origin to the shared OAuth client's Authorized JavaScript origins if not already there
- [ ] Turn this file into a real GitHub issue (or close it), then delete `issues/`

Details: README, "Publishing to GitHub".
