# Handoff

## Current task and status
Redline works and is pushed; Tim has used it live since 2026-10-28 and confirmed P7 and D2. The folder is now Claude-Redline. F8 (the register.js cleanup) is finished in the working tree and waiting on Tim's yes to commit: 22 tests pass, the regress harness output is identical, and the validator passes.

## Files touched
- `claude-redline/hooks/register.js`: F8 cleanup (window list derived from `WINDOWS`, `timeoutMs` parameter, no unused catch binding, aligned failure labels).
- `HANDOFF.md`: this rewrite.

## Next step
Commit F8, then work the agreed order, one item at a time: G9 (add `node --test tests/redline.test.mjs` to pre-push), F6 and D3 together (skip a `usage.json` write when percentages are unchanged and the last write was under about 60 seconds ago; also write when the surface is `desktop`, which Tim must test himself), F7 (build a side-by-side mockup of icon colors 59 and 89 against the status line's 70 and 95, and show Tim before changing anything), then I1, F12, F16, and V2 last, then P9 and D5.

P9 is still open: Redline loads only as `redline@inline` through `CLAUDE_CODE_PLUGIN_DIRS` and is not installed in the real config. After P9, local development needs the env var back or a push plus `claude plugin update`, so do it right before the directory submission. The directory validator says the icon may become the listing icon only once, at first save or submission, so V2 must use the final icon.

## Open questions
- Decided 2026-11-12: submit to the directory (D5), F11 needs no change. D1 (other window kinds) is still open: the recommendation is to close it as not now, waiting on Tim.
- Tim can delete the old history folder `~\.claude\projects\c--Users-Tim-Documents-VS-Code-Claude-Usage-Extension` and `~\.claude\settings.json.before-rename` when ready.

## Tried and failed
- Newlines in a toast are not rendered, so each window is its own toast.
- Edit and Write fail with "classifier gave no verdict" in auto mode. Node patch scripts in `scratch/` work (Tim approved this for F8). In heredocs, write backslashes with `String.fromCharCode(92)`, because the tool layer mangles them.
