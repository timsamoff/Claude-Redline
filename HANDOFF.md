# Handoff

## Current task and status
Redline works and is pushed; Tim has used it live since 2026-10-28 and confirmed P7 and D2. The folder is now Claude-Redline. F8 (the register.js cleanup) is committed; G9 (tests in pre-push, rule S1) is committed and pushed. F6 and D3 are committed and pushed, so Tim can install from the marketplace and test them.

## Files touched
- `claude-redline/hooks/register.js`: F8 cleanup (window list derived from `WINDOWS`, `timeoutMs` parameter, no unused catch binding, aligned failure labels).
- `claude-redline/hooks/register.js`: F6 skips an unchanged write for REWRITE_AFTER_SECONDS (60); D3 writes and toasts on SURFACES (vscode, desktop).
- `tests/redline.test.mjs`: two new tests (throttle, desktop). 24 pass; the regress harness differs only by three skipped repeat writes.
- `README.md`, `DESIGN.md`, `CLAUDE.md`: surfaces and the throttle.

## Next step
Tim tests F6 (usage.json still updates in VS Code, rewrites at most about once a minute for an unchanged reading) and D3 (does the plugin load in the Claude desktop app and write usage.json; toasts there too). The desktop app shows only installed plugins, so D3 needs the marketplace install (P9) first. Then mark F6 and D3 done in TODO.md, and go on in the agreed order: F7 (build a side-by-side mockup of icon colors 59 and 89 against the status line's 70 and 95, and show Tim before changing anything), then I1, F12, F16, and V2 last, then P9 and D5.

P9 is still open: Redline loads only as `redline@inline` through `CLAUDE_CODE_PLUGIN_DIRS` and is not installed in the real config. After P9, local development needs the env var back or a push plus `claude plugin update`, so do it right before the directory submission. The directory validator says the icon may become the listing icon only once, at first save or submission, so V2 must use the final icon.

## Open questions
- Decided 2026-11-12: submit to the directory (D5), F11 needs no change, D1 closed as not now.
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work (Tim approved this for F8). In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
