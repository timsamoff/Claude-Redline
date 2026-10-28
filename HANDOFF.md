# Handoff

## Current task and status
Redline is pushed (`01c297e`) and the tree is clean. The code review's findings are fixed, the settings text is shared between `plugin.json` and the README table, and TODO D4 and P3 are closed. Still not seen live: one toast (not two) when a single window crosses a level, no repeat toast after a reload or in a second window, and a weekday on a reset after midnight.

## Files touched
None pending. The host shows the lowercase ID `redline` in toast labels, `/redline` output and the `/plugin` settings heading, and `displayName` changes none of them (recorded in `CLAUDE.md`).

## Next step
**First, remind Tim to run the P7 live checks** (he asked on 2026-10-28 before logging off). Steps: set Toast levels to a value just below one window's current usage but above the other's (run `/redline` to see them), restart Claude Code, send a prompt, and expect one toast for only that window. Then reload the VS Code window and open a second window, and expect no repeat toast. The weekday-after-midnight check only shows when the 5-hour reset falls after midnight. Set Toast levels back to `70, 90` afterward.

P1 passed: in an isolated config, `claude plugin marketplace add timsamoff/Claude-Redline` and `claude plugin install redline@timsamoff-tools` worked from GitHub. The installed copy has only the three plugin files, matches the repo byte for byte, and validates. The one thing it could not do is start a session, so TODO P9 is Tim's: install it in the real config, remove `CLAUDE_CODE_PLUGIN_DIRS` from `~/.claude/settings.json`, and confirm it loads in VS Code. The GitHub topics are set (P6 done). Other open items: P7 (three live checks), P8 (folder rename, last), D5 (directory submission), F7 (icon colors, later).

## Open questions
- The repo is public. Whether to submit to Anthropic's directory is TODO D5.
- Icon colors (59 and 89) differ from the status line colors (70 and 95), TODO F7. Tim will decide later.
- The folder rename goes last, TODO P8.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
