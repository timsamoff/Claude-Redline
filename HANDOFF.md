# Handoff

## Current task and status
A full code review's 11 findings are fixed and pushed (`562c78f`). Tests (22), the validator, the gate checks and the integration suite (122 scenarios) pass. Three behavior changes are not yet seen live.

## Files touched
- `claude-redline/hooks/register.js`: only the window with news gets a toast; state saved with `$.store`; weekday for any other-day reset; `%` accepted in levels; `USERPROFILE` first; percents rounded down; late-reading guard.
- `claude-redline/.claude-plugin/plugin.json`: `version` removed, `displayName` "Claude-Redline", descriptions updated.
- `.claude-plugin/marketplace.json`, `README.md`, `DESIGN.md`, `CLAUDE.md`: updated to match, including the validator quote.
- `scripts/sentinel/lib/consistency.mjs`: K3 accepts one `[segment(...)]` per toast; dead demo branch removed. Integration anchors updated.
- `tests/redline.test.mjs`: 7 new tests. `assets/cr-screenshot.png`: Tim's edit.

## Next step
Tim checks live after `/reload-plugins`: one toast (not two) when a single window crosses a level, no repeat toasts after a reload or in a second window, and a weekday on a reset after midnight. Then start TODO D4 (review the settings wording).

## Open questions
- Keep "2.1.299" as the minimum version in the README? It is unverified.
- `version` is now omitted; pin 1.0.0 at the first real release.
- Repo visibility, and directory submission prep (copy the PNG into the plugin folder).
- Custom levels now differ from `statusline.sh` cutoffs (TODO F7).
- The folder rename to Claude-Redline goes last (`scratch/rename-project.ps1`).

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
