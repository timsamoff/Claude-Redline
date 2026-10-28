<img src="prod/claude-redline-icon-512.png" width="128px" alt="Claude Redline">

# Claude-Redline

A Claude Code plugin that writes `~/.claude/usage.json` and shows usage-limit toasts in VS Code sessions, where the status line never runs.

The Claude Code status line can write your current 5-hour and 7-day usage to a file, but the VS Code extension does not run a status line, so that file goes stale there. Claude-Redline is a small plugin mod that reads the same usage figures inside VS Code, keeps the file current in the same format, and pops up a toast when a limit window crosses 70, 90 or 95 percent.

Rate-limit figures exist only for claude.ai Pro and Max subscriptions. On other sign-ins the plugin has nothing to report.

## What it does and what it touches

A mod runs inside Claude Code with your permissions, so here is exactly what this one does. It listens for two events (`session.measure` and `turn.complete`), and when the session is drawing in VS Code it:

- reads the rate-limit windows and context fill Claude Code already has,
- reads the `HOME` or `USERPROFILE` environment variable to find your home folder,
- writes `~/.claude/usage.json`, and
- shows toasts.

It makes no network calls and starts no processes. This is the output of `claude plugin validate ./claude-redline`:

```
./register.js hooks: session.measure, turn.complete
./register.js calls: $.env.get (via homeDir), $.fs.write (via writeUsage), $.session.surfaces (via handle), $.session.usage, $.ui.log, $.ui.toast (via demo, handle, notify)
./register.js env writes: nothing
./register.js env reads: HOME, USERPROFILE
```

The whole mod is one file, [register.js](claude-redline/hooks/register.js), so you can read it before you install it. [DESIGN.md](DESIGN.md) explains how it works.

## Install

You need Claude Code and the VS Code extension at version 2.1.299 or later, because mods draw in the VS Code panel from that version.

From the Claude Code marketplace flow:

```
claude plugin marketplace add timsamoff/Claude-Redline
claude plugin install redline@timsamoff-tools
```

Or load a clone of this repo for one session:

```
claude --plugin-dir ./claude-redline
```

## What you see

A toast appears the first time a window crosses each level: 70 percent (notice), 90 percent (also shows the reset time) and 95 percent (alert, which stays longer). It also appears when a window resets, and once if the file cannot be written. Each toast covers both windows, for example "yellow circle 5h 72% | green circle 7d 32%". The host adds a "redline plugin" label in front of the text, and the plugin cannot change that.

## Settings

Change these in `/plugin` and restart Claude Code for them to take effect.

| Setting | Default | Range | What it does |
|---|---|---|---|
| Toast duration (seconds) | 6 | 1 to 120 | How long notice toasts stay |
| Alert toast duration (seconds) | 10 | 1 to 120 | How long 95 percent and write-failure toasts stay |
| Preview sample toasts | Off | Off or On | On shows one sample of each toast style on the first turn after a restart |

## The usage.json format

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

Percents and `updated_at` are numbers. The `*_resets_at` values are epoch seconds as strings. A missing window is `null` and an empty string, and if both windows are missing nothing is written. The format mirrors the file written by the author's own terminal status line script, so anything that reads one reads the other.

## Limits

- It writes only when the session is drawing in VS Code, so it does not compete with a terminal status line.
- The write replaces the file in place and is not atomic, so a reader could in principle catch it half written.
- Only the 5-hour and 7-day windows are used. Other limit types are ignored.
- The Claude desktop app is not supported yet.

## Status

Early, version 0.0.1. Verified in live VS Code sessions on Claude Code 2.1.301: the plugin loads, both windows arrive, the file is written and keeps updating, and toasts appear with their icons. The threshold and reset logic has been tested with fake data, and a real threshold crossing has not been seen yet. Installing through the marketplace has not been tested yet.

## License

MIT. See [LICENSE](LICENSE).
