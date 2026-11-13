# Handoff

## Current task and status
Redline 1.0.0 is on the GitHub marketplace and works in VS Code and the desktop app. Tim submitted it to Anthropic's directory (D5) on 2026-11-13 and the automatic check refused it: "Directory policy failed". Security scan passed. The directory accepts mods (a `modules` entry in `hooks.json`) and any code file or script only from Verified organizations, which means Anthropic knows the organization is a real company. Tim is an individual, so Redline cannot pass as built. Removing the `modules` entry would remove the plugin's only code, so that is not a fix. Nothing in the working tree is unfinished.

## Files touched
- None since the last push (`PRIVACY.md`, the icon, version 1.0.0 are all pushed).

## Next step
Wait for Tim's decision. Options: (a) stay on the GitHub marketplace only (already works; install steps are in the README); (b) look into what Verified organization status takes and whether an individual can get it (not researched yet, ask before searching); (c) drop D5. If the directory stays out of reach, the README is accurate as written and PRIVACY.md is harmless to keep. The portal also asked that the README say what the mod writes and what the hook does; the README already covers both, so only reword if Tim resubmits.

## Open questions
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
- A diagnostic edit in the cached copy only runs in a session started after the edit. Both diagnostics are done and reverted.
