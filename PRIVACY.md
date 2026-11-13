# Claude-Redline privacy policy

Effective 2026-11-13.

Claude-Redline (the `redline` plugin) keeps everything on your computer. It makes no network requests, runs no background processes, and sends nothing to the developer or anyone else.

## What Redline reads

Redline reads these through Claude Code's plugin API:

- Your 5-hour and 7-day usage windows: the percent used and when each resets.
- The percent of the context window in use.
- The `HOME` or `USERPROFILE` environment variable, to find your home folder.
- Its own saved state, described below.

It does not read your prompts, Claude's responses, your transcripts, the files in your projects, your login credentials or tokens, or any other environment variable.

## What Redline writes

- `~/.claude/usage.json`, in VS Code and in the Claude desktop app. It holds the two usage percents, the two reset times, the context percent, and a timestamp. It's plain text, and any program running as you can read it. Delete the file whenever you like. Redline recreates it the next time it writes.
- Saved state in Claude Code's plugin store. It records which usage window has been announced at which level, and when that window resets, so you don't get the same toast twice.
- Short status and error lines in Claude Code's debug log, which Claude Code writes locally when you run it in debug mode. They can include the path of `usage.json` and the usage percents.

## What Redline shows

Redline shows toasts (small popups) with your usage percents and reset times, and the same information when you run `/redline`.

## Network, sharing and telemetry

Redline makes no network calls. It has no analytics, no telemetry, and no accounts. It shares nothing with third parties. `claude plugin validate` lists every call the plugin makes, and the README quotes that list.

The usage figures come from Claude Code, which gets them from Anthropic's service as part of normal operation. That happens whether or not Redline is installed. Anthropic's own policies cover that data and Claude Code in general. This policy covers only Redline.

If you or another tool you run reads `usage.json` and sends it somewhere, that is outside Redline's control.

## Settings

Your Redline settings (toast levels, durations, time format, and the window On/Off choices) are stored by Claude Code with your other plugin settings.

## Changes

If this policy changes, the change is committed to this repository, and the date above is updated. The git history shows what changed.

## Contact

Open an issue at https://github.com/timsamoff/Claude-Redline/issues.
