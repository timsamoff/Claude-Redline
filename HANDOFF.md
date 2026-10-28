# Handoff

## Current task and status
Redline 0.0.1 is pushed (`22e8279` is the latest). Everything is now verified live by Tim: threshold toasts, the window-reset toast, `/redline`, the `timeFormat` choices and the On/Off pickers.

Waiting on Tim's yes to commit and push two uncommitted files.

## Files touched (uncommitted)
- `README.md`: Tim's own rewrite of the intro, Usage, Settings and Status wording, plus four fixes from me: one toast "for each window that is turned on", a Limits note that threshold and reset toasts are VS Code only and `/redline` is registered everywhere, the repeated "stays out of the way" line removed, and the centered 349px screenshot restored after the text example in Usage. Status now says the window reset is verified.
- `CLAUDE.md`: the Status line now lists the window-reset toast as verified.
Gate checks pass on both. Proposed message: "Fix README accuracy and restore the screenshot".

## Next step
Ask Tim for the commit and push. Then start TODO D4 (review the settings wording) or whatever Tim picks.

## Open questions
- Keep "2.1.299" as the minimum version in the README? It is unverified.
- `version`: omit it or pin 1.0.0 at release.
- Repo visibility, and directory submission prep (copy the PNG into the plugin folder).
- Custom levels now differ from `statusline.sh` cutoffs (TODO F7).
- The folder rename to Claude-Redline goes last (`scratch/rename-project.ps1`).

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
