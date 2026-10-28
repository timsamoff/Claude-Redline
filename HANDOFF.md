# Handoff: Claude-Redline

Updated 2026-10-28, when Tim logged off partway through Sentinel prompt 03. Last pushed commit: 86be4bf, plus the handoff commit that follows this edit. Uncommitted: Tim's own rewrite of `README.md`, and the new `scripts/sentinel/` files.

## 1. Current task and status
Building Sentinel prompt 03 (gate-check implementation). Every question is answered, and the build is about a third done. Nothing is wired up: `core.hooksPath` is unset and no hook files exist, so nothing can block a commit yet.

Decisions approved by Tim:
- Native git hooks, with source tracked in `.githooks/` and `scripts/sentinel/` (Node, no dependencies).
- The first commit that adds a new kind of file is blocked once, the type is recorded, and the retry passes.
- The checks carry their own rules and do not read the local `INTEGRATION_CHECKLIST.md`.
- The validator runs only when the plugin folder, marketplace file or README is in the commit.
- Commit messages: subject up to 72 characters, up to 4 bullets, each bullet one line up to 80 characters, no wrapped bullets, no trailers, no override.
- Agent-voice phrase list approved as proposed. "Claude" and "Claude Code" are left off it.
- Tracked `.claude/settings.json` with a `SessionStart` hook that prints this file. Tim chose tracked, and the docs say repo hooks apply in single-repo cloud sessions.

Written, untracked, syntax-checked only: `scripts/sentinel/` has `rules.json`, `sentinel-exceptions.json` (empty), `baseline.json` (empty), and in `lib/`: `git.mjs`, `report.mjs`, `commit-message.mjs`, `signals.mjs` (documentation gates), `consistency.mjs` (K1, K2, K3, K6, K8 and README phrases) and `validator.mjs` (K4, K5, via `claude plugin validate --json`).

Not written yet: `lib/extensions.mjs`, `lib/notes.mjs`, `check.mjs` (hook modes, `--full`, `--notes`, `--install`, `--last-message`), `session-start.mjs`, the three `.githooks/` shims, `.claude/settings.json`, and `tests/`.

The plugin itself is unchanged. Still unverified in live VS Code: the wrap fix, a real threshold or reset toast, and the Off/On picker.

## 2. Files touched
- `scripts/sentinel/`: new and untracked, as listed above.
- `README.md`: changed on disk by Tim, not by this session, and not touched here. It is uncommitted.
- Everything else is unchanged since the last handoff. See `git log`.

## 3. Next steps
1. Write the missing pieces. The shims must try `node` on PATH, then `C:\Program Files\nodejs\node`, then fail loudly.
2. Run `node scripts/sentinel/check.mjs --install` (sets `core.hooksPath` and the executable bit), and seed `.git/sentinel/known-extensions.txt` from history and the working tree, including `.mjs`.
3. Test. Unit tests for the message and signal logic. Integration tests as real `git commit` attempts in a scratch clone under `scratch/`: a blatantly bad message, staged-versus-unstaged content, each rule, deletions, a large diff, a forced tool failure, and exceptions (expired and content-keyed). Test pre-push against a local bare remote, and the session-start hook with `claude -p`.
4. Run the report-only baseline pass (Part 4), record it in `baseline.json`, and log anything found in `Sentinel-Notes/TODO.md`.
5. Update `CLAUDE.md` (the modes, the close-out step `check.mjs --notes`, the commit-autonomy choice) and the local checklist and TODO statuses.
6. Ask Tim the commit-autonomy question (three options) and how to group the commits. Do not commit mid-run.
7. Tim will rename the folder last, with `scratch/rename-project.ps1` (dry run by default; `-Apply` from outside the folder after closing VS Code).

## 4. Open questions for Tim
- His README edit starts with a ```markdown fence and ends with a closing fence, so GitHub would show the whole file as one code block. The icon `<img>` line is gone. The link to `register.js` says `claude-redline/register.js`, but the file is `claude-redline/hooks/register.js`. It also says "my terminal status line script". Does he want these fixed?
- Add a README integrity check (relative links resolve, fences balanced, icon line present)? It is not in the approved list and is logged as TODO G6.
- Whether to omit `version`, whether the preview option ships publicly, and the repo's visibility (not checked).

## 5. Tried and failed, and facts learned
- A git hook finds `node` and `claude` with a normal PATH but neither with a stripped PATH, so the shim needs fallbacks and the checks must fail loudly.
- `claude plugin validate --json` returns `success`, errors and the exact `notes` lines, and exits 1 for a missing folder. Both validations take about 1.7 seconds. Use it instead of scraping text.
- A marketplace entry whose name differs from the manifest name still passes the validator, which is why check K6 exists.
- In auto mode the Edit and Write tools intermittently fail with "classifier gave no verdict". Ask Tim before using a PowerShell workaround.
- The plugin ID cannot start with `claude-`, and a `CLAUDE.md` inside the plugin folder makes the validator warn.
- A new conversation in an open window reuses the running process, so settings changes need a window reload or a restart.
