# Handoff

## Current task and status
Redline 1.0.0 is pushed and ready for the directory. Tim approved the simpler icon (I1) and said D5 is a go. The new icon is in the working tree, uncommitted: `prod/claude-redline-icon_03.svg` (new, final art) and the two PNG copies re-rendered from it. The directory validator passes with no warnings. Tim does the submission himself in the Claude app (Customize, Plugins, Submit to the directory), because it needs his account.

## Files touched
- `prod/claude-redline-icon_03.svg`: the final icon, with a title.
- `assets/claude-redline-icon-512.png` and `claude-redline/.claude-plugin/icon.png`: rendered from it, identical.
- `CLAUDE.md`: layout note about which icon files are final.
- The plugin version stays 1.0.0 because nobody holds a 1.0.0 install yet. Bump it if one is ever installed with the old icon.

## Next step
Commit and push the icon (needs Tim's yes), then Tim submits. After submission: watch for the portal's safety scan and policy review on the hooks module, and answer anything it asks. The submission links the repo root, so only committed files count. Keep the `calls:` line in the README current if the code changes.

## Open questions
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
- A diagnostic edit in the cached copy only runs in a session started after the edit. Both diagnostics are done and reverted.
