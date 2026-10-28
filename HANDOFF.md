# Handoff: Claude-Redline

Updated 2026-10-28, after finishing Sentinel prompt 03. Last pushed commit: 68325d9, plus the handoff commit that follows this edit. Uncommitted: Tim's own rewrite of `README.md`.

## 1. Current task and status
All four Sentinel prompts are finished. The gate checks are live and pushed:
- Git hooks (`commit-msg`, `pre-commit`, `pre-push`) in `.githooks/`, checks in `scripts/sentinel/`, and `core.hooksPath` set in this clone.
- Verified by 87 real-commit scenarios in a throwaway clone and by fresh `claude -p` sessions for the session-start hook. The first full scan of the real tree found nothing, so `baseline.json` is empty.
- A tracked `.claude/settings.json` SessionStart hook prints this file at the start of a session.
- Commit and push autonomy: confirm every time. The one exception is this file, which may be committed and pushed alone at close-out.

Still unverified in live VS Code: the toast wrap fix, a real threshold or reset toast, the Off/On picker, and a marketplace install from a fresh clone.

## 2. Files touched
- Committed in `85cbe05`: `.githooks/`, `scripts/sentinel/` (checks, rules, empty exceptions and baseline, the integration suite), `.claude/settings.json`, `.gitattributes`.
- Committed in `68325d9`: `CLAUDE.md` (a "Gate checks" section, the autonomy choice, a `--notes` close-out step).
- Local only: `Sentinel-Notes/TODO.md` (25 open, 14 done), `INTEGRATION_CHECKLIST.md` (implementation status added), `PROJECT_PROFILE.md`.
- `README.md`: Tim's own uncommitted rewrite. Still not touched by this session.

## 3. Next steps
1. Get Tim's decision on the README (first open question below).
2. Recommended next TODO item: P1, adding `author`, `homepage` and `repository` to `plugin.json`. It clears the validator's author warning and is needed for the directory. It was not started because prompt 03 says to wait for Tim's review of this run's backlog (T1, E3, G6, G8).
3. Other open work: tests for `register.js` (F4), a copy of the icon inside the plugin folder, and a marketplace install test from a fresh clone.
4. Tim will rename the folder last with `scratch/rename-project.ps1` (a dry run by default; `-Apply` from outside the folder, after closing VS Code). `core.hooksPath` is relative, so the hooks survive the rename.
5. In any new clone, run `node scripts/sentinel/check.mjs --install`. Until then the clone has no enforcement. The hooks need Node on the committing machine.

## 4. Open questions for Tim
- His README edit starts and ends with a ```markdown fence (GitHub would show one code block), has lost the icon `<img>` line, links to `claude-redline/register.js` instead of `claude-redline/hooks/register.js`, and says "my terminal status line script". Fix these? None of the approved checks catch them.
- Add a README integrity check (relative links resolve, fences balanced, icon line present)? Logged as TODO G6, not built.
- Claude Code reports that two `Write(...)` allow rules in `~/.claude/settings.json` never match, because only `Edit(...)` rules apply to file writes. This may explain some auto-mode blocks (TODO E3). Fix them?
- Whether to omit `version`, whether the preview option ships publicly, and the repo's visibility (not checked).

## 5. Tried and failed, and facts learned
- Hook shell scripts must keep LF line endings (`.gitattributes` enforces it). The executable bit must be committed with `git add --chmod=+x`; a `git reset` loses an index-only change.
- A git hook finds `node` and `claude` with a normal PATH but not with a stripped one, so the shims search the standard Node path and the validator runner searches the usual `claude` locations. Both fail loudly if nothing is found.
- `claude plugin validate --json` is the reliable way to read the validator. A marketplace entry whose name differs from the manifest name still passes the validator, which is why check K6 exists.
- A broken `rules.json` once crashed with a raw stack trace. It now reports plainly and blocks.
- Never use `--no-verify`. A commit that bypasses the hooks is caught later by the `pre-push` full scan.
- The Edit and Write tools failed intermittently in earlier sessions ("classifier gave no verdict") and worked in this one. Ask Tim before using a PowerShell workaround.
- The plugin ID cannot start with `claude-`, and a `CLAUDE.md` inside the plugin folder makes the validator warn.
