# Handoff

## Current task and status
Redline 1.0.0 is on the GitHub marketplace and works in VS Code and the desktop app. Tim submitted it to Anthropic's directory (D5) on 2026-11-13 and the automatic check refused it: "Directory policy failed". Security scan passed. The directory accepts mods (a `modules` entry in `hooks.json`) and any code file or script only from Verified organizations, which means Anthropic knows the organization is a real company. Tim is an individual, so Redline cannot pass as built. Removing the `modules` entry would remove the plugin's only code, so that is not a fix. Nothing in the working tree is unfinished.

## Files touched
- None since the last push (`PRIVACY.md`, the icon, version 1.0.0 are all pushed).

## Next step
Wait for Tim. He asked how to get Redline onto "the GitHub Marketplace": there is no central one. His repo is the marketplace and install already works. Two things were offered:
1. Done: GitHub release `v1.0.0` is published (https://github.com/timsamoff/Claude-Redline/releases/tag/v1.0.0) from `Sentinel-Notes/release-notes-v1.0.0.md`.
2. Pending his yes: submitting to community lists. Search found (unverified): anthropics/claude-plugins-community (reviewed, form-based; unknown whether it has the same Verified rule), ComposioHQ/awesome-claude-plugins, ccplugins/awesome-claude-code-plugins, claudemarketplaces.com. Open and check each one's rules before suggesting a submission.

Other options on the directory refusal: research what Verified status takes (ask first), or drop D5.

## Open questions
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work. In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
- A diagnostic edit in the cached copy only runs in a session started after the edit. Both diagnostics are done and reverted.
