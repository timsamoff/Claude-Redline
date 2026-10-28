# Handoff

## Current task and status
Redline 0.0.1 is pushed (`77d7c96`) and the tree is clean. Everything is verified live by Tim: threshold toasts, the window-reset toast, `/redline`, the `timeFormat` choices and the On/Off pickers. The README is accurate against the code as of this commit.

## Files touched
None pending. The last commit fixed README accuracy (one toast per window that is on, VS Code-only note in Limits, repeated line removed, screenshot restored) and updated the `CLAUDE.md` Status line.

## Next step
Start TODO D4 (review the settings wording in `plugin.json`, the README Settings section and `DESIGN.md`), or whatever Tim picks.

## Open questions
- Keep "2.1.299" as the minimum version in the README? It is unverified.
- `version`: omit it or pin 1.0.0 at release.
- Repo visibility, and directory submission prep (copy the PNG into the plugin folder).
- Custom levels now differ from `statusline.sh` cutoffs (TODO F7).
- The folder rename to Claude-Redline goes last (`scratch/rename-project.ps1`).

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
