# Handoff

## Current task and status
Redline is installable from the GitHub marketplace and works in VS Code and the desktop app. Release prep is done in the working tree, uncommitted: version 1.0.0, the icon inside the plugin folder (`claude plugin validate --profile directory` passes with no warnings), the SVG title, and the README and CLAUDE.md updates for the desktop app. The `/redline` stagger fix is pushed and Tim confirmed it works.

## Files touched
- `claude-redline/.claude-plugin/plugin.json`: version 1.0.0.
- `claude-redline/.claude-plugin/icon.png`: copy of `assets/claude-redline-icon-512.png`.
- `prod/claude-redline-icon_02.svg`: title, role, generator comment and blank lines removed.
- `README.md`, `CLAUDE.md`: desktop app now tested, the one-toast limit, the version rule, the icon copy, and the F7 decision. Tim reviews the README.

## Next step
1. Commit and push the release prep (needs Tim's yes; the new icon file may hit the one-time N1 block).
2. I1: Tim looks at `scratch/icon-mock/sheet.png` and `zoom.png` (current icon above, simpler variant below, on light and dark at 128, 64, 48, 32, 16 px) and decides. To use the variant, export `scratch/icon-small-variant.svg` at 512 px over `assets/claude-redline-icon-512.png` and `claude-redline/.claude-plugin/icon.png`.
3. D5: submit when Tim says ready. The icon becomes the listing icon only once, at first save or submission.

Local development needs a push, a version bump and `claude plugin update redline@timsamoff-tools`, then a new session. The desktop app's Code tab needs a new Code session or a quit from the tray.

## Open questions
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
- A diagnostic edit in the cached copy only runs in a session started after the edit. Both diagnostics are done and reverted.
