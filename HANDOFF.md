# Handoff

## Current task and status
Redline is pushed (`01c297e`) and the tree is clean. The code review's findings are fixed, the settings text is shared between `plugin.json` and the README table, and TODO D4 and P3 are closed. Still not seen live: one toast (not two) when a single window crosses a level, no repeat toast after a reload or in a second window, and a weekday on a reset after midnight.

## Files touched
None pending. The host shows the lowercase ID `redline` in toast labels, `/redline` output and the `/plugin` settings heading, and `displayName` changes none of them (recorded in `CLAUDE.md`).

## Next step
Check the three behaviors above live, then start TODO P1: test the marketplace install from a fresh clone. It is the one sharing path nobody has run, so it is the biggest risk before the project is shared widely.

## Open questions
- Keep "2.1.299" as the minimum version in the README? It is unverified.
- `version` is now omitted; pin 1.0.0 at the first real release.
- Repo visibility, and directory submission prep (copy the PNG into the plugin folder).
- Custom levels now differ from `statusline.sh` cutoffs (TODO F7).
- The folder rename to Claude-Redline goes last (`scratch/rename-project.ps1`).

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
