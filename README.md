<img src="prod/claude-redline-icon-512.png" width="128px" alt="Claude Redline">

# Claude-Redline

Claude-Redline is a small Claude Code plugin that keeps your usage data up to date and shows usage-limit notifications while you're working in VS Code.

Normally, the Claude Code status line can write your current 5-hour and 7-day usage to `~/.claude/usage.json`. The problem is that the VS Code extension doesn't run a status line, so that file stops updating when you're working there.

Redline fills that gap.

It reads the same usage data from Claude Code, writes it to `~/.claude/usage.json` in the same format, and shows a toast when either usage window crosses 70%, 90%, or 95%.

> **Note:** Rate-limit data is only available with claude.ai Pro and Max subscriptions. If Claude Code doesn't provide usage data for your account, Redline has nothing to report.

## What it does

Redline listens for two Claude Code events:

- `session.measure`
- `turn.complete`

When the current session is running in VS Code, it:

- Reads the 5-hour and 7-day usage windows
- Reads the current context fill
- Finds your home folder using `HOME` or `USERPROFILE`
- Writes the data to `~/.claude/usage.json`
- Shows notifications when you approach a usage limit

That's it.

Redline doesn't make network requests or start any processes.

You can verify what the plugin accesses yourself:

```text
./register.js hooks: session.measure, turn.complete
./register.js calls: $.env.get (via homeDir), $.fs.write (via writeUsage), $.session.surfaces (via handle), $.session.usage, $.ui.log, $.ui.toast (via demo, handle, notify)
./register.js env writes: nothing
./register.js env reads: HOME, USERPROFILE
```

The entire plugin is contained in [`register.js`](claude-redline/hooks/register.js), so you can read the whole thing before installing it.

See [`DESIGN.md`](DESIGN.md) for more about how it works.

## Install

Redline requires Claude Code and the VS Code extension version **2.1.299 or later**. That's when mods gained the ability to draw in the VS Code panel.

Install it through the Claude Code marketplace:

```bash
claude plugin marketplace add timsamoff/Claude-Redline
claude plugin install redline@timsamoff-tools
```

Or clone the repository and load the plugin for a single session:

```bash
claude --plugin-dir ./claude-redline
```

## Notifications

Redline shows a notification the first time either usage window crosses:

- **70%**: Notice
- **90%**: Warning, including the reset time
- **95%**: Alert that stays on screen longer

It also notifies you when a usage window resets and once if `usage.json` can't be written.

Each notification shows both usage windows, even if only one triggered it. For example:

```text
🟡 5h 72% | 🟢 7d 32%
```

Claude Code automatically adds a `redline plugin` label in front of the notification. Plugins currently can't change that.

## Settings

Settings can be changed through `/plugin`.

Restart Claude Code after changing them.

| Setting | Default | Range | What it does |
| --- | --- | --- | --- |
| Toast duration (seconds) | 6 | 1–120 | How long regular notifications stay on screen |
| Alert toast duration (seconds) | 10 | 1–120 | How long 95% and write-failure alerts stay on screen |
| Preview sample toasts | Off | Off / On | Shows one example of each notification style on the first turn after restarting |

## `usage.json`

Redline writes usage data to:

```text
~/.claude/usage.json
```

The file looks like this:

```json
{
  "five_hour_pct": 41,
  "seven_day_pct": 32,
  "five_hour_resets_at": "1792443000",
  "seven_day_resets_at": "1792706400",
  "context_pct": 6,
  "updated_at": 1792441730
}
```

`five_hour_pct`, `seven_day_pct`, `context_pct`, and `updated_at` are numbers.

The `*_resets_at` values are epoch seconds stored as strings.

If one usage window isn't available, its percentage is `null` and its reset value is an empty string. If neither window is available, Redline doesn't write the file.

The format matches the file written by my terminal status line script, so anything that reads one can read the other.

## A few limitations

- Redline only writes usage data when Claude Code is running in VS Code. This keeps it from competing with a terminal status line.
- The file is replaced in place rather than written atomically, so it's technically possible for another process to read it in the middle of a write.
- Only the 5-hour and 7-day usage windows are tracked. Other limit types are ignored.
- The Claude desktop app isn't supported yet.

## Current status

Redline is early. The current version is **0.0.1**.

I've verified it in live VS Code sessions with Claude Code 2.1.301. The plugin loads, both usage windows come through, `usage.json` is written and continues updating, and the notifications appear with the correct icons.

I've also tested the threshold and reset behavior using fake data.

A real usage window crossing one of the thresholds hasn't been observed yet, and marketplace installation hasn't been tested yet.

If you run into something, open an issue.

## License

MIT. See [`LICENSE`](LICENSE).
