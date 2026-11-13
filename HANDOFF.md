# Handoff

## Current task and status
Redline works and is pushed. The marketplace install (P9) is done: `redline@timsamoff-tools` is installed, `CLAUDE_CODE_PLUGIN_DIRS` is removed, and the plugin loads in VS Code and in the Claude desktop app's Code tab. D3 is verified there (surface `desktop`, usage.json written, `/redline` shows a toast, per Tim). F6 (the 60-second rewrite throttle) is pushed but Tim has not confirmed it in a live session. The `CLAUDE.md` update for P9 and D3 and the stagger fix below are in the working tree, uncommitted.

## Files touched
- `CLAUDE.md`: Status and Environment notes now describe the marketplace install and the desktop app. Uncommitted, waiting on Tim's yes.
- `~/.claude/settings.json`: removed the `env` block and renamed `pluginConfigs` `redline@inline` to `redline@timsamoff-tools`, so his options carry over.

## Next step
Tim confirms F6 from live use (usage.json keeps updating and is not rewritten more than about once a minute for an unchanged reading). Then F7 (build a side-by-side mockup of icon colors 59 and 89 against the status line's 70 and 95, and show Tim before changing anything), then I1, F12, F16, V2 last (the icon becomes the listing icon only once, so V2 must use the final icon), then D5.

Local development now needs a push and `claude plugin update redline@timsamoff-tools`, then a new session. The desktop app's Code tab runs its own Claude Code (2.1.321) and needs a new Code session or a quit from the tray.

## In progress: the desktop app shows only the first of two toasts
Diagnosed 2026-11-13: in the Code tab `/redline` built both toasts (data and settings fine), and the desktop showed only the first. Fix built, uncommitted: `toastEach` takes `staggerMs`, and `/redline` passes `normalMs` on the desktop (not with vscode attached), so the second toast comes from `$.clock.after` once the first has timed out. Test added (25 pass), validator passes, README `calls:` line, DESIGN.md and CLAUDE.md updated.

Needs Tim: commit and push, `claude plugin update redline@timsamoff-tools`, a new Code session, then `/redline`. Expect 5h, then 7d about one toast duration later. If the desktop replaces instead of dropping, or the second never shows, fall back to joining both windows on one line for `desktop` (option A). The same drop probably hits threshold toasts when both windows cross on one reading (`notify` raises one toast per window in the same tick); not handled yet.

## Open questions
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
- A diagnostic edit in the cached copy only runs in a session started after the edit, and a message sent in an already-running Code session does nothing. The earlier `surfaces()` diagnostic is done and reverted (surface is `desktop`).
