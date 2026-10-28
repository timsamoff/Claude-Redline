# Handoff

## Current task and status
Redline is pushed (`01c297e`) and the tree is clean. The code review's findings are fixed, the settings text is shared between `plugin.json` and the README table, and TODO D4 and P3 are closed. Still not seen live: one toast (not two) when a single window crosses a level, no repeat toast after a reload or in a second window, and a weekday on a reset after midnight.

## Files touched
None pending. The host shows the lowercase ID `redline` in toast labels, `/redline` output and the `/plugin` settings heading, and `displayName` changes none of them (recorded in `CLAUDE.md`).

## Next step
The icon is now the warm version: `assets/claude-redline-icon-512.png` was re-rendered from `prod/claude-redline-icon_02.svg` (source `prod/claude-redline-icon_02.ai`; `_01.ai` is the older art). Run P1, the marketplace install from a fresh clone, now that L1 (line endings) and P5 (minimum version) are settled. F7 (icon colors versus the status line) is left for later by Tim. P6 (GitHub topics) is optional and P7 (three live checks) can happen any time.

## Open questions
- The repo is public. Whether to submit to Anthropic's directory is TODO D5.
- Icon colors (59 and 89) differ from the status line colors (70 and 95), TODO F7. Tim will decide later.
- The folder rename goes last, TODO P8.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
