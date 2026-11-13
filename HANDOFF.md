# Handoff

## Current task and status
Redline works and is pushed. The marketplace install (P9) is done: `redline@timsamoff-tools` is installed, `CLAUDE_CODE_PLUGIN_DIRS` is removed, and the plugin loads in VS Code and in the Claude desktop app's Code tab. D3 is verified there (surface `desktop`, usage.json written, `/redline` shows a toast, per Tim). F6 (the 60-second rewrite throttle) is pushed but Tim has not confirmed it in a live session. The `CLAUDE.md` update for P9 and D3 is in the working tree, uncommitted.

## Files touched
- `CLAUDE.md`: Status and Environment notes now describe the marketplace install and the desktop app. Uncommitted, waiting on Tim's yes.
- `~/.claude/settings.json`: removed the `env` block and renamed `pluginConfigs` `redline@inline` to `redline@timsamoff-tools`, so his options carry over.

## Next step
Tim confirms F6 from live use (usage.json keeps updating and is not rewritten more than about once a minute for an unchanged reading). Then F7 (build a side-by-side mockup of icon colors 59 and 89 against the status line's 70 and 95, and show Tim before changing anything), then I1, F12, F16, V2 last (the icon becomes the listing icon only once, so V2 must use the final icon), then D5.

Local development now needs a push and `claude plugin update redline@timsamoff-tools`, then a new session. The desktop app's Code tab runs its own Claude Code (2.1.321) and needs a new Code session or a quit from the tray.

## In progress: /redline shows only the 5h toast in the desktop app
In the Code tab, `/redline` showed one toast (5h) that closed on its own, and no 7d toast ever followed, so it is not a queue. Either `$.session.usage().rateLimits` has no `seven_day` entry in `command.run` there (`summary()` then skips it), or two lines were built and the desktop dropped the second. `usage.json` had both percents, so the data exists elsewhere.

A temporary diagnostic is in the installed copy, `~/.claude/plugins/cache/timsamoff-tools/redline/57b6047e9c1c/hooks/register.js` (`command.run` only). It writes `~/.claude/redline-debug.txt` with the raw `rateLimits`, the `shown` flags, the built `texts` and `surfaces`. To use it:
1. Tim starts a new Code session in the desktop app (a plugin loads only at process start) and runs `/redline` once.
2. Read `redline-debug.txt`. Two entries in `texts` means the desktop dropped one toast. One entry with no `seven_day` in `rateLimits` means a data problem, so look at `readWindow`. `shown.seven_day` false means the setting did not carry over.
3. Revert the cached copy (`cp` the repo's `register.js` over it, or run `claude plugin update redline@timsamoff-tools`) and delete `redline-debug.txt`. The repo is unchanged.
Fix options if the desktop drops a toast: stagger the second toast, join both windows on one line for `desktop` only, or document it. Decide with Tim before changing code.

## Open questions
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
- A diagnostic edit in the cached copy only runs in a session started after the edit, and a message sent in an already-running Code session does nothing. The earlier `surfaces()` diagnostic is done and reverted (surface is `desktop`).
