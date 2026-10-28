# Claude-Redline: Design

Claude-Redline is a Claude Code plugin mod. In VS Code sessions it writes the current rate-limit usage to `~/.claude/usage.json` and shows a toast when a limit window reaches 70, 90 or 95 percent. The plugin ID is `redline`.

## Purpose

A terminal status line script can write `~/.claude/usage.json`, but the Claude Code VS Code extension does not run a status line, so the file goes stale in VS Code sessions. The usage data does reach plugin mods through `$.session.usage()`. Claude-Redline reads it there and writes the same file in the same format, so tools that read the file keep working.

## Components

| Path | Role |
|---|---|
| `claude-redline/.claude-plugin/plugin.json` | Manifest: plugin ID, description, and the user options |
| `claude-redline/hooks/hooks.json` | Points Claude Code at the hooks module |
| `claude-redline/hooks/register.js` | The hooks module, about 210 lines |
| `prod/` | Icon artwork: an Illustrator source and an SVG export |
| `assets/` | The 512 px PNG icon the README shows |

Claude Code also generates `claude-redline/.claude-plugin/types/` and `claude-redline/tsconfig.json` for editor type hints. Both are git-ignored and not needed at runtime.

## Runtime model

The hooks module registers four handlers:
- `session.start`: registers the `/redline` command with `$.command.register`.
- `command.run` for `redline`: shows the current 5-hour and 7-day usage and reset times in a toast and returns no chat text. It reads the figures with `$.session.usage()` and writes nothing.
- `session.measure`: fires after each turn and when a usage figure changes (context, cost or a rate-limit window).
- `turn.complete`: fires when a turn ends. This hook reads the figures itself with `$.session.usage()`.

The last two hooks run the same handler. The handler does nothing unless `$.session.surfaces()` includes `vscode`. That keeps the plugin from writing alongside a terminal status line from the same session. Otherwise it does two independent things: write the file, then decide whether to toast. A failure in one does not stop the other.

The mod calls only these parts of the mods API: `$.command.register`, `$.session.surfaces`, `$.session.usage`, `$.env.get` (for `HOME` and `USERPROFILE`), `$.fs.write`, `$.ui.toast` and `$.ui.log` (to the debug log). It makes no network calls and starts no processes. `claude plugin validate` lists these calls.

## Data

Each rate-limit entry has a `kind`, a `percentUsed` (0 to 100, at most one decimal) and a `resetsAt` (an ISO 8601 string). Only the `five_hour` and `seven_day` kinds are used. Other kinds, such as a spend limit, are ignored.

`usage.json` has six keys:

| Key | Type | Source |
|---|---|---|
| `five_hour_pct` | number or null | `percentUsed` of the `five_hour` window |
| `seven_day_pct` | number or null | `percentUsed` of the `seven_day` window |
| `five_hour_resets_at` | string | epoch seconds as text, or an empty string |
| `seven_day_resets_at` | string | epoch seconds as text, or an empty string |
| `context_pct` | number or null | the live context window fill |
| `updated_at` | number | epoch seconds when the file was written |

A missing window gives `null` and an empty string. If both windows are missing, no file is written. The format matches the maintainer's own terminal status line script, which is outside this repository.

The file is written to `<home>/.claude/usage.json`, where `<home>` is `HOME`, or `USERPROFILE` if `HOME` is unset. The write replaces the file in place and is not atomic. The mods API documents this behavior.

## Toasts

Each reading shows a window as `icon 5h: 72%`, with `- resets at <time>` after it when its reset is known. Each window is its own toast, 5-hour first, because a toast does not render a line break and a wrapped single line can split an icon from its label. The `showFiveHour` and `showSevenDay` options turn a window's toasts off; `usage.json` is still written. Toasts appear only when something new happened:
- **Threshold crossing.** The default levels are 70 and 90, and the `levels` option (up to 5 values) replaces them. 95 is always a level on top of those, and it is the alert level. Each is announced once per window per reset cycle. If a reading crosses several at once, only the highest is announced.
- **Reset time.** Every announced level adds `- resets at <time>` to that window's text, with the weekday name before "at" when the reset is more than a day away. The time follows the `timeFormat` option.
- **Window reset.** When a window reports a later reset time than before, its text gets `(window reset)` and its levels are armed again.
- **Write failure.** One toast per failure streak, `usage.json write failed: <error>`.

The icon follows the percentage and is fixed, not tied to the `levels` option: a red circle from 89 percent, a yellow circle from 59 percent, otherwise a green circle. The failure toast uses a warning sign. Each window's icon, label and percentage are joined with non-breaking spaces so a wrapped toast does not split them.

Notice-level toasts last 6 seconds by default and alert-level toasts (95 percent and write failures) last 10. The host adds a "redline plugin" label before the text. The mod cannot change that label.

State (the highest level announced per window, the last reset time, whether a failure was already announced) lives in module variables. It resets when the mod reloads or Claude Code restarts. Two VS Code windows each keep their own state.

## Configuration

Options are declared in `plugin.json` under `userConfig` and reach the mod as the `options` argument of `register(on, options)`.

| Option | Default | Range | Effect |
|---|---|---|---|
| `toastSeconds` | 6 | 1 to 120 | Duration of notice-level toasts |
| `alertToastSeconds` | 10 | 1 to 120 | Duration of alert-level and failure toasts |
| `levels` | 70, 90 | 1 to 100, up to 5 values | Percentages that trigger a toast, in addition to the fixed 95. Invalid input falls back to the default |
| `showFiveHour` | On | On or Off | Whether the 5-hour window gets toasts, including in `/redline` |
| `showSevenDay` | On | On or Off | Whether the 7-day window gets toasts, including in `/redline` |
| `timeFormat` | System | System, 12-hour, 24-hour or UTC | How reset times read. System follows the computer's locale, 12-hour and 24-hour use the local time zone, and UTC shows 24-hour UTC. A reset more than a day away also names the weekday |

The defaults and range exist in both `plugin.json` and `register.js` and must match. A change to an option takes effect after Claude Code restarts. The `options` field on the On/Off and format options makes the plugin require Claude Code v2.1.271 or later, according to the plugin docs.

## Constraints of the mod runtime

- The hooks module has no Node and no DOM. Every effect goes through `$`.
- `$` can be passed to top-level functions in the same file, but not to functions imported from another file, so those functions stay in `register.js`. Only pure helpers could move.
- Event names passed to `on` must be string literals.
- Module state is per process and is rebuilt when the mod reloads.
- `session.measure` fires often (context and cost changes included), so the file is rewritten frequently. In one 50-minute window on 2026-10-28, the log shows 46 writes, with a longest gap of 504 seconds.
- A `session.measure` or `turn.complete` event can arrive with an empty `surfaces` list. The handler skips it. Three such events occurred in the same window.

## Verification status

Observed in live VS Code sessions (Claude Code 2.1.301, 2026-10-19 and 2026-10-28):
- The mod loads and both rate-limit windows arrive, on a 0 to 100 scale.
- `surfaces` is `["vscode"]`.
- `usage.json` is written in the correct format, keeps updating, and followed a window reset.
- Toasts render with the emoji icons. The duration options can be changed in `/plugin`.

Checked only with fake data: threshold and reset toast behavior, option handling and clamping, and the write-failure path.

Not yet verified: a threshold or reset toast at a real crossing, whether the non-breaking spaces prevent the wrap seen in a screenshot, how the Off/On picker looks, behavior with other rate-limit kinds, and behavior in the Claude desktop app.