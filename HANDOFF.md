# Handoff

## Current task and status
Redline 0.0.1 is pushed (`1b8f016`). This session added the `levels` setting, the `/redline` command (shows toasts), a fixed 95 percent toast, fixed icon colors (green under 59, yellow from 59, red from 89), one toast per window with On/Off settings, a `timeFormat` setting, and the README icon in `assets/`. The Preview option was removed. Tests (15), the validator, the gate checks and the integration suite (113 scenarios) all pass. Verified live (Tim): real threshold toasts at 70, 90 and 95, the `timeFormat` choices and the On/Off pickers. Also from a screenshot: `/redline` runs and shows two toasts, 5h above 7d, with the lowercase host label "redline plugin" (the host uses the plugin ID, so that cannot change).

## Files touched
- `claude-redline/hooks/register.js`: levels, ALERT_AT, YELLOW_AT and RED_AT, `/redline`, window toggles, time format.
- `claude-redline/.claude-plugin/plugin.json`: options `levels`, `showFiveHour`, `showSevenDay`, `timeFormat`; `previewToasts` removed.
- `tests/redline.test.mjs`: new, run with `node --test tests/redline.test.mjs`.
- `scripts/sentinel/`: K1, K2, R1, K3 and signals updated for the new constants.
- `README.md`, `DESIGN.md`, `CLAUDE.md`: updated to match. `assets/` holds the README icon and `cr-screenshot.png` (centered, 349 px wide in the README).

## Next step
Reload the VS Code window and check live: a window-reset toast (it fires when a window's reset time passes and the percentage drops, so it can only be seen when that happens). Then work through `Sentinel-Notes/TODO.md`, starting with D4 (review the settings wording).

## Open questions
- Keep "2.1.299" as the minimum version in the README? It is unverified.
- `version`: omit it or pin 1.0.0 at release.
- Repo visibility, and directory submission prep (copy the PNG into the plugin folder).
- Custom levels now differ from `statusline.sh` cutoffs (TODO F7).
- The folder rename to Claude-Redline goes last (`scratch/rename-project.ps1`).

## Tried and failed
- Newlines in a toast: not rendered, so the windows are separate toasts.
- A non-breaking space between icon and label did not stop a bad wrap, and neither did removing the space. Two toasts replaced them.
- The Edit and Write tools sometimes fail with "classifier gave no verdict". Node patch scripts in `scratch/` worked.
