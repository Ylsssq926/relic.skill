# Stable Maintenance Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Bring the repository back into a reliable maintenance state after domain/dependency drift and recent README/CI cleanup.

**Architecture:** Keep the scope narrow: fix factual drift, align lockfiles with the existing dependency edit, remove generated visual-test artifacts from git, and expand CI only for the demo-site. Do not refactor product code or change README positioning beyond keeping the existing style intact.

**Tech Stack:** GitHub Actions, Next.js demo-site, npm lockfile, markdownlint, Python compile check.

---

### Task 1: Update current facts in BRAND.md

**Files:**
- Modify: `BRAND.md`

**Steps:**
1. Replace the outdated old-domain facts with `https://relic.luelanai.com` as the canonical demo domain.
2. Keep the existing tone and compact bullet style.
3. Do not rewrite the brand voice sections.

**Verify:**
- `git grep -n "relic.luelan.online" -- ':!demo-site/node_modules'` should not find tracked product/docs references except git internals.

### Task 2: Align demo-site dependency metadata

**Files:**
- Modify: `demo-site/package.json`
- Modify: `demo-site/package-lock.json`

**Steps:**
1. Preserve the existing `demo-site/package.json` user change from `lucide-react ^1.8.0` to `^0.577.0`.
2. Upgrade `next` / `eslint-config-next` from `16.2.3` to the `16.2.7` security patch after npm audit confirms the high-severity advisory.
3. Regenerate/update `demo-site/package-lock.json` so the root package dependency and locked package agree.

**Verify:**
- `demo-site/package.json` and `demo-site/package-lock.json` both reference `lucide-react` consistently.

### Task 3: Remove generated visual test screenshots from git

**Files:**
- Modify: `.gitignore`
- Untrack: `demo-site/test-results/visual/*.png`

**Steps:**
1. Add recursive ignore rules for nested test/report output: `**/test-results/` and `**/playwright-report/`.
2. Use `git rm --cached -r demo-site/test-results/` so local files are preserved but no longer tracked.

**Verify:**
- `git ls-files demo-site/test-results/` should be empty.

### Task 4: Add demo-site CI coverage

**Files:**
- Modify: `.github/workflows/ci.yml`

**Steps:**
1. Add a `demo-site` job after the markdown/Python jobs.
2. Use `actions/setup-node@v4` with Node 22 and npm cache scoped to `demo-site/package-lock.json`.
3. Run `npm ci` in `demo-site`.
4. Run `npm run typecheck`, `npm run lint`, and `npm run build` in `demo-site`.

**Verify:**
- GitHub Actions should show Markdown Lint, Python Compile Check, and Demo Site checks.

### Task 5: Final verification and release

**Steps:**
1. Run Python compile check.
2. Run controlled demo-site checks after dependency alignment.
3. Commit changes with a maintenance-focused message.
4. Push to `origin/main` and wait for CI success.
5. If CI passes, tag a patch release only if version metadata is updated; otherwise treat the push as the published maintenance release.
