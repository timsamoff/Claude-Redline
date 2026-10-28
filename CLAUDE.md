# Claude-Redline

Claude Code plugin mod that writes `~/.claude/usage.json` in VS Code sessions, where the status line never runs, and shows usage-limit toasts. `DESIGN.md` explains how it works. `HANDOFF.md` holds the current unfinished state.

## Status
Working and pushed. In live VS Code sessions the mod loads, reads both rate-limit windows, writes `usage.json` in the status line's format, and shows toasts. Not yet verified live: a real 70, 90 or 95 percent toast, a window-reset toast, the non-breaking-space wrap fix, and the Off/On picker for `previewToasts`. Shareable through a GitHub marketplace once pushed: `README.md`, an MIT `LICENSE` and `.claude-plugin/marketplace.json` exist and validate. Still missing for Anthropic's directory: a PNG icon and the manifest's `author`, `homepage` and `repository`. A marketplace install has not been tested.

Tim tests changes himself. Do not claim a change works in VS Code until he reports what he saw.

## Naming
- The project, repo and folder are Claude-Redline. The plugin ID in `plugin.json` is `redline` and must stay that: `claude plugin validate` rejects third-party plugin names that start with `claude-`.
- Plugin ID `redline` is permanent. Renaming breaks existing installs. `displayName` can differ.
- The marketplace `name` is the part after `@` in an install ID. It must not be an official name or resemble one. Suggested: `timsamoff-tools`.
- The entry `name` in `marketplace.json` must equal the `name` in `plugin.json`.

## Layout
- `claude-redline/` is the plugin: `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.js` (ES module, no DOM, no Node, every effect goes through `$`).
- `prod/` holds the icon art (Illustrator source and SVG export). Both are tracked.
- `README.md`, `LICENSE` (MIT), `CLAUDE.md`, `DESIGN.md`, `HANDOFF.md` and `.claude-plugin/marketplace.json` (marketplace `timsamoff-tools`, entry `redline`, source `./claude-redline`) are tracked at the repo root. Keep `CLAUDE.md` out of `claude-redline/`, because `claude plugin validate` warns about a `CLAUDE.md` at the plugin root.
- Local only (git-ignored): `Sentinel-Notes/` (audit report, `TODO.md`, design briefs, `archive/`), `Sentinel-Prompts/`, `PROJECT_PROFILE.md`, `scratch/`, and the files Claude Code generates in `claude-redline/` (`tsconfig.json`, `.claude-plugin/types/`).
- `CLAUDE.md` is shared on purpose. `Sentinel-Notes/` is local-only by Tim's choice, and `HANDOFF.md` is tracked because he sometimes runs sessions on other machines.

## Where information goes
- A tracked, unresolved inconsistency goes in `Sentinel-Notes/TODO.md`, with a one-line pointer here so drift is not mistaken for convention.
- A settled operational convention goes here.
- A settled architectural decision, for a human reader, goes in `DESIGN.md`.
- Something an outside user needs goes in the README.
- A declined suggestion goes in `TODO.md` if it is "not now", or here or in `DESIGN.md` with its reasoning if it is a settled "no".

## usage.json contract (must match `~/.claude/statusline.sh`)
- Keys: `five_hour_pct`, `seven_day_pct`, `five_hour_resets_at`, `seven_day_resets_at`, `context_pct`, `updated_at`.
- Percents and `updated_at` are numbers. The `*_resets_at` values are epoch seconds as strings.
- A missing window is `null` for the percent and `""` for the reset time. If neither window exists, skip the write.
- `$.session.usage()` gives `percentUsed` (0 to 100) and `resetsAt` as an ISO 8601 string. Convert with `String(Math.floor(Date.parse(resetsAt) / 1000))`.
- Map by `kind`: `five_hour` and `seven_day` only. Ignore `spend_limit` and model-scoped kinds.

## Rules for the code
- Do not change `~/.claude/hooks/usage-check.sh` or `~/.claude/statusline.sh`. Claude-Redline matches their format.
- `usage-check.sh` treats a file older than 900 seconds as stale, so write on `turn.complete` as well as `session.measure`.
- `$.fs.write` is not atomic. Write only when `$.session.surfaces()` includes `vscode`, so Claude-Redline never races the terminal status line.
- Toast levels are the named constants `NOTICE_AT` (70), `RESET_TIME_AT` (90) and `ALERT_AT` (95), announced once per window per reset cycle. Do not write a threshold or duration as a bare number elsewhere.
- The `userConfig` defaults and limits in `plugin.json` must equal the duration constants in `register.js`. JSON cannot import them, so check both when changing either.
- Build toast text only through `segment()` and `failureText()`, so the preview samples cannot drift from the real format. Icon, label and percent are joined with non-breaking spaces.
- Functions that take `$` stay in `register.js`. The validator rejects passing `$` to a function imported from another file. Event names passed to `on` must be string literals.
- Run `claude plugin validate ./claude-redline` after any change to the plugin folder.
- Never read credential files or call undocumented usage endpoints without Tim's explicit say-so.

## Comments
Terse. A comment is one or two sentences, a pointer to what the code does or why. Anything longer (background, history, design reasoning, edge cases) goes in this file or `DESIGN.md`. This is a standing rule for every comment written from now on.

## Commit style
(Copied word for word from Tim's own configuration.)
- Single-line commit summaries by default; avoid sprawling descriptions.
- If a description is genuinely needed, keep it to a few single-sentence bullets, not a narrative.
- Default to one commit per session unless changes are large enough to warrant splitting.
- Never include co-author notes in commit messages.

Commit messages are written in Tim's voice and describe the change, never the agent or the session. No trailers of any kind. Never commit or push without Tim's explicit yes, with one exception: at close-out the agent may commit and push `HANDOFF.md` alone, with a one-line message, and tell Tim afterward.

## Handoff
(The format below is copied word for word from Tim's own configuration.)

Write it to Sentinel-Notes/HANDOFF.md if the project has a Sentinel-Notes/ folder, otherwise to HANDOFF.md in the project root, replacing any earlier version. Keep it under one page. Include:
1. Current task and its status
2. Files touched, with a one-line note on each change
3. Next step, specific enough to start without re-reading the chat
4. Open questions or decisions waiting on me
5. Anything tried that failed, so it is not repeated

Project override: here the handoff lives at `HANDOFF.md` in the project root even though `Sentinel-Notes/` exists, because `Sentinel-Notes/` is local-only and a remote session sees only committed files.

- Rewrite it whenever the state of unfinished work changes (a step finishes, the plan changes, an attempt fails), not only at the end, so a session that ends without warning leaves a handoff at most one step behind.
- When a later session finishes the work it describes, clear it. A stale handoff is worse than none.
- Anything in it that becomes settled moves to the file named in "Where information goes".
- At the start of every new session, before answering the first message, read `HANDOFF.md` and the open items in `Sentinel-Notes/TODO.md` (if that folder exists on this machine), in that order. If a handoff exists, say briefly what it describes. Compare it with the working tree, and if there are uncommitted changes it does not mention, say so in the same line.

## Sessions on other machines
Tim sometimes runs sessions away from this computer. A remote session sees only committed files, so `CLAUDE.md`, `DESIGN.md` and `HANDOFF.md` are tracked and the rest of the notes are local. Anything a remote session writes is lost unless it is committed.

## TODO and notes conventions
- Finished `TODO.md` items move to the Done section. A finished design brief moves to `Sentinel-Notes/archive/`.
- Every `TODO.md` entry is one line with one sentence. Anything longer becomes a `[issue]-design-brief.md` file and the entry links to it.
- After finishing an item, name the strongest next item with a reason and start on it. Items carry no priority, effort or dependency data, so this is a judgment from the wording. Say so plainly, and let Tim redirect.
- Updating `TODO.md` is part of finishing the work an item describes, not a step to remember afterward.
- When any distinct task reaches a stopping point, mention the open backlog if nothing in it has been touched since before the task began. A short mention is enough, and skip it if it was already raised this session.

## Close-out
Run this when writing the handoff and whenever a distinct task finishes:
1. Rewrite or clear `HANDOFF.md`.
2. Update `Sentinel-Notes/TODO.md` (move finished items to Done, archive finished briefs).
3. Commit and push `HANDOFF.md` alone if it changed. Any other commit or push waits for Tim's yes.
4. End with one line saying what was done and what was skipped and why.

## Publishing plan (checked against the plugin docs, 2026-10-28)
Details and the full step list are in `Sentinel-Notes/submission-readiness-design-brief.md`.
- Keep the plugin in `claude-redline/`. Add `.claude-plugin/marketplace.json` at the repo root with one entry (`name` `redline`, `source` `./claude-redline`). Put the README and LICENSE at the repo root too.
- Users install with `claude plugin marketplace add timsamoff/Claude-Redline`, then `claude plugin install redline@<marketplace-name>`.
- Anthropic's directory is stricter: it needs a README of 40 words or more, a LICENSE (or a `license` SPDX id), and a square PNG or JPEG icon, 512 to 2048 px under 2 MB. SVG is not accepted. Check with `claude plugin validate ./claude-redline --profile directory`.
- `version`: if `plugin.json` sets it and commits are pushed without bumping it, `claude plugin update` tells users they are current. Plan: omit it while the project changes fast, pin 1.0.0 at the first real release.
- The README must say plainly that this is a mod running with the user's permissions, and what it does: reads rate-limit windows, writes `~/.claude/usage.json`, shows toasts, no network calls. Quote the `calls:` lines from `claude plugin validate`. Document the `usage.json` format and say it mirrors Tim's own status line script.

## Environment notes
- `scratch/` (git-ignored) is for one-off scripts, so a stable in-project path can be allowed by a permission rule later. Do not use the OS temp directory or long inline one-liners. `scratch/regress-harness.mjs` replays 21 fake-data scenarios through the hooks. Run it with `MOD=<path to a copy of register.js renamed .mjs>` and compare the output before and after a change.
- Changing a plugin option in `/plugin` needs a Claude Code restart. A new conversation in an open window reuses the running process, so reload the window or restart after changing settings.
- Tim's local sessions load the plugin through `env.CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`. Remove it after a normal install.
- In auto mode the Edit and Write tools have intermittently failed with "classifier gave no verdict". Ask Tim before using a PowerShell workaround, and do not edit his permission settings.