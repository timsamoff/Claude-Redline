# Handoff

## Current task and status
Redline 0.0.1 is pushed (`56df4cb`). Verified live (Tim): threshold toasts, `/redline`, the `timeFormat` choices and the On/Off pickers. Unverified: the window-reset toast, which only happens when a window rolls over.

In progress: Tim edited `README.md` (uncommitted) and asked me to verify it against the code and to "fix the screenshot". I audited the edits and stopped at the usage limit before fixing anything.

## Files touched
- `README.md`: Tim's uncommitted rewrite of the intro, Usage, Settings and Status wording. The screenshot block is gone from it (see below). I have not edited it this round.
- `HANDOFF.md`: this file.

## Audit of Tim's README edits (against `register.js`)
- Accurate: the 95% alert always on, the icon cutoffs, the Settings table, the alert duration text, `/redline` showing only the windows that are on, and the Status wording. Gate checks pass on the file as it stands.
- Wrong or missing: "Redline shows two toasts" is untrue when a window is turned off, so say "one toast per window that is on".
- Wrong or missing: the Limits section says only that usage data is written in VS Code. Threshold and reset toasts also appear only in VS Code (`handle()` skips other surfaces), while `/redline` registers everywhere.
- Style, not accuracy: "Once installed, Redline stays out of the way..." repeats the paragraph before it.
- Missing: the screenshot block, `<p align="center"><img src="assets/cr-screenshot.png" alt="Two Redline toasts in VS Code, one for the 5-hour window and one for the 7-day window" width="349px"></p>`. It was after the text example in Usage. Tim says to fix it, so put it back unless he meant something else.

## Next step
Ask Tim what "fix the screenshot" means if it is not "restore it". Otherwise re-add the block above after the text example in the Usage section of `README.md`, apply the two accuracy fixes (one toast per window that is on, and the VS Code-only toast note in Limits) if Tim agrees, run `node scripts/sentinel/check.mjs`, and ask before committing.

## Open questions
- Keep "2.1.299" as the minimum version in the README? It is unverified.
- `version`: omit it or pin 1.0.0 at release.
- Repo visibility, and directory submission prep (copy the PNG into the plugin folder).
- Custom levels now differ from `statusline.sh` cutoffs (TODO F7).
- The folder rename to Claude-Redline goes last (`scratch/rename-project.ps1`). TODO D4 (review the settings wording) is open.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
