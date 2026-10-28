# Handoff: Claude-Redline

Updated 2026-10-28, after the Sentinel integration audit. Last pushed commit: 86be4bf (plus this handoff update). Everything is committed and pushed.

## 1. Current task and status
The audit is finished and its code fixes are applied. `register.js` now has one set of duration constants, named threshold constants (`NOTICE_AT`, `RESET_TIME_AT`, `ALERT_AT`), a shared `readWindow` helper, and `segment()` and `failureText()` helpers that join icon, label and percent with non-breaking spaces. A 63-run fake-data harness showed identical toast text, timeouts and written files before and after, apart from the intended non-breaking spaces. `claude plugin validate` passes.

Not verified in a live VS Code session: the wrap fix, a real threshold or reset toast, and the Off/On picker for `previewToasts`.

Sentinel progress: prompts 00 (discovery), 01 (design and code quality audit) and 02 (integration audit) are done. Prompt 03 (gate check implementation) is next. Nothing is enforced yet: no hooks exist, and the checks are only described in the local `INTEGRATION_CHECKLIST.md`. Audit results and the backlog are in the local `Sentinel-Notes/`. `CLAUDE.md` holds the decisions made along the way.

## 2. Files touched
- `claude-redline/hooks/register.js`: refactor and a two-line header comment. Behavior unchanged except the non-breaking spaces.
- `DESIGN.md`: new, at the repo root.
- `README.md`, `LICENSE` (MIT) and `.claude-plugin/marketplace.json`: new, at the repo root. The README quotes the validator's `calls:` output.
- `CLAUDE.md`: rewritten and now tracked (stale status fixed, conventions added).
- `HANDOFF.md`: this file, now tracked.
- Integration audit changes: `CLAUDE.md` gained the commit-body rule, the no-override rule and a "Keep docs in step" section. `.gitignore` now also ignores `INTEGRATION_CHECKLIST.md`. Local only: `INTEGRATION_CHECKLIST.md` (new) and `Sentinel-Notes/TODO.md` (gate-check and line-ending items).
- `.gitignore`: now ignores `Sentinel-Notes/`, `Sentinel-Prompts/`, `PROJECT_PROFILE.md`, `scratch/` and the generated `claude-redline/tsconfig.json`. `CLAUDE.md` and `HANDOFF.md` are no longer ignored.
- Local only: `Sentinel-Notes/` (report, `TODO.md`, two briefs), `scratch/regress-harness.mjs`, `PROJECT_PROFILE.md`.
- `claude-redline/.claude-plugin/plugin.json`: added `displayName` ("Claude Redline"). The ID stays `redline`.
- `prod/claude-redline-icon-512.png`: new, a 512 px PNG rendered from the SVG with ImageMagick. The README's first line uses it. `prod/` otherwise holds Tim's Illustrator source and SVG. An Illustrator rename to `_01` seen earlier was undone.

## 3. Next steps
1. Done: committed and pushed in three commits on 2026-10-28. `6aed80a` is the `register.js` refactor, `25bf846` the docs, and `5336ebe` the publishing files (README, MIT license, marketplace file, PNG icon, `displayName`).
2. Reload VS Code and check the toast wrapping, a real threshold toast and the picker (TODO P3, P4).
3. Publish: `README.md`, an MIT `LICENSE` and `.claude-plugin/marketplace.json` now exist and validate. Still to do: manifest `author`, `homepage` and `repository`, and a test of the marketplace install from a fresh clone. The PNG exists in `prod/`, but the directory validator only looks inside the plugin folder, so a copy at `claude-redline/.claude-plugin/icon.png` (or an `icon` field in `plugin.json`) is still needed. See `Sentinel-Notes/submission-readiness-design-brief.md`.
4. Optional: rename the project folder to `Claude-Redline` with `scratch/rename-project.ps1` (local, git-ignored). It runs as a dry run by default. Use `-Apply` from a PowerShell window outside the folder, after closing VS Code and any Claude session for it. It renames the folder, copies Claude's history folder to the new name, and updates the plugin path in `~/.claude/settings.json`. Only the dry run has been tested.
5. After a restart, check whether `displayName` ("Claude Redline", added to `plugin.json`) changes the "redline plugin" label on toasts. Unverified.
6. Next audit prompt: `Sentinel-Prompts/03-gate-check-implementation.md`. It builds the checks in `INTEGRATION_CHECKLIST.md`. Decisions it must confirm with Tim: where the hook source lives, the commit-message caps (proposed 72 and 4), and how often to run the validator.
7. Done: the integration-audit edits to `CLAUDE.md` and `.gitignore` were committed and pushed as `86be4bf`.

## 4. Open questions for Tim
- Whether `.gitignore` should skip Illustrator temp files (one appeared in `prod/` earlier).
- Whether to omit `version`, whether the preview option ships publicly, and the repo's visibility (not checked). The license is decided: MIT.

## 5. Tried and failed
- In auto mode the Edit and Write tools intermittently fail with "classifier gave no verdict". File writes were done through PowerShell with Tim's approval. Ask again before using that route.
- A `CLAUDE.md` inside the plugin folder makes the validator warn, so it stays at the repo root.
- The plugin ID cannot start with `claude-`.
- A new conversation in an open window reuses the running process, so settings changes need a window reload or a restart.