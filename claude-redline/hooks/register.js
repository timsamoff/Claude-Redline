// Claude-Redline: writes ~/.claude/usage.json and shows usage toasts in VS Code sessions.
// Routine results go to the debug log, and CLAUDE.md and DESIGN.md hold the format and toast rules.

// Default toast levels, in percent used. Users can replace them with the levels setting.
const DEFAULT_LEVELS = [70, 90]
// Always a toast level, on top of the user's levels. It and anything above it get the longer alert duration.
const ALERT_AT = 95
const MAX_LEVELS = 5
// Icon colors, in percent used: yellow from YELLOW_AT, red from RED_AT. Fixed, not tied to the levels setting.
const YELLOW_AT = 59
const RED_AT = 89
const WINDOWS = [['five_hour', '5h'], ['seven_day', '7d']]
const GREEN = '\u{1F7E2}'
const YELLOW = '\u{1F7E1}'
const RED = '\u{1F534}'
const WARN = '\u26A0\uFE0F'
const NBSP = '\u00A0'
const TIME_FORMATS = ['System', '12-hour', '24-hour', 'UTC']
// Key in the plugin's own store for the announcement state, shared across windows and restarts.
const STORE_KEY = 'windows'

// Toast durations in seconds. Keep in step with userConfig in plugin.json.
const DEFAULT_TOAST_SECONDS = 6
const DEFAULT_ALERT_SECONDS = 10
const MIN_SECONDS = 1
const MAX_SECONDS = 120

// Per window: { ms: reset time in ms, fired: highest level already toasted }.
const state = { five_hour: null, seven_day: null }
let writeFailed = false

// Settings in effect. Replaced from userConfig in register().
let levels = DEFAULT_LEVELS
let normalMs = DEFAULT_TOAST_SECONDS * 1000
let alertMs = DEFAULT_ALERT_SECONDS * 1000
let timeFormat = TIME_FORMATS[0]
// Which windows get toasts. Replaced from userConfig in register().
const shown = { five_hour: true, seven_day: true }

function secondsToMs(value, fallbackSeconds) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallbackSeconds * 1000
  return Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS) * 1000
}

// Reads the levels setting ("70, 90" or "70%, 90%"): sorted, unique, 1 to 100, at most MAX_LEVELS. Falls back to the defaults if none is valid.
function parseLevels(value) {
  const raw = (Array.isArray(value) ? value.join(',') : String(value == null ? '' : value)).split(/[\s,;%]+/)
  const nums = [...new Set(raw.filter((s) => s !== '').map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 100))].sort((a, b) => a - b)
  return nums.length ? nums.slice(-MAX_LEVELS) : DEFAULT_LEVELS
}

function icon(pct) {
  if (pct >= RED_AT) return RED
  if (pct >= YELLOW_AT) return YELLOW
  return GREEN
}

// An On/Off setting. Anything but off or false counts as on.
function isOn(value) {
  return !['off', 'false'].includes(String(value).trim().toLowerCase())
}

// Reads the timeFormat setting, case-insensitively. Falls back to the first (System) format.
function parseTimeFormat(value) {
  const want = String(value == null ? '' : value).trim().toLowerCase()
  return TIME_FORMATS.find((f) => f.toLowerCase() === want) || TIME_FORMATS[0]
}

// A calendar date as YYYY-MM-DD in the given zone, for comparing days.
function dayKey(date, zone) {
  return date.toLocaleDateString('en-CA', zone)
}

// "at 2:20 PM" for a reset later today, or "Thursday at 3:00 PM" for any other day. Follows the timeFormat setting.
function resetTime(ms) {
  try {
    const utc = timeFormat === 'UTC'
    const zone = utc ? { timeZone: 'UTC' } : {}
    const clock = { hour: 'numeric', minute: '2-digit', ...zone }
    if (timeFormat === '12-hour') clock.hour12 = true
    if (timeFormat === '24-hour' || utc) Object.assign(clock, { hour: '2-digit', hourCycle: 'h23' })
    const d = new Date(ms)
    let text = 'at ' + d.toLocaleTimeString([], clock) + (utc ? ' UTC' : '')
    if (dayKey(d, zone) !== dayKey(new Date(), zone)) text = d.toLocaleDateString([], { weekday: 'long', ...zone }) + ' ' + text
    return text
  } catch (err) {
    return ''
  }
}

// One window's percent used and reset time (ms, NaN when absent), or null if missing.
function readWindow(rateLimits, kind) {
  const w = (rateLimits || []).find((r) => r.kind === kind)
  if (!w) return null
  return { pct: w.percentUsed, ms: w.resetsAt ? Date.parse(w.resetsAt) : NaN }
}

function windowFor(rateLimits, kind) {
  const w = readWindow(rateLimits, kind)
  if (!w) return { pct: null, resetsAt: '' }
  return {
    pct: w.pct,
    resetsAt: Number.isFinite(w.ms) ? String(Math.floor(w.ms / 1000)) : '',
  }
}

// The percent is shown rounded down, so 94.6 never reads as a 95 that has not been announced.
// Non-breaking spaces are harmless here but did not stop bad wraps, which is why each window has its own toast.
function segment(pct, label, note) {
  return icon(pct) + NBSP + label + ':' + NBSP + Math.floor(pct) + '%' + (note || '')
}

function failureText(err) {
  return WARN + ' usage.json write failed: ' + String(err)
}

// The toast texts for /redline: one per window, or a single message when there is no data.
function summary(rateLimits) {
  const parts = []
  for (const [kind, label] of WINDOWS) {
    const w = readWindow(rateLimits, kind)
    if (w && shown[kind]) parts.push(segment(w.pct, label, Number.isFinite(w.ms) ? ' - resets ' + resetTime(w.ms) : ''))
  }
  if (parts.length) return parts
  return [WINDOWS.some(([kind]) => shown[kind]) ? 'No usage data yet. It appears after the first response, on Pro and Max plans.' : 'Both windows are turned off in the Redline settings.']
}

// One toast per text, so each window has its own.
function toastEach($, texts, ms) {
  for (const text of texts) $.ui.toast(text, { timeoutMs: ms })
}

// USERPROFILE first, because on Windows HOME can be a Git Bash path such as /c/Users/name.
async function homeDir($) {
  const profile = await $.env.get('USERPROFILE')
  if (profile) return profile
  return await $.env.get('HOME')
}

// Returns a short status string for the debug log. Throws on failure.
async function writeUsage($, usage) {
  const five = windowFor(usage.rateLimits, 'five_hour')
  const seven = windowFor(usage.rateLimits, 'seven_day')
  if (five.pct === null && seven.pct === null) return 'skipped: no five_hour or seven_day window'

  const home = await homeDir($)
  if (!home) throw new Error('neither HOME nor USERPROFILE is set')

  const body = {
    five_hour_pct: five.pct,
    seven_day_pct: seven.pct,
    five_hour_resets_at: five.resetsAt,
    seven_day_resets_at: seven.resetsAt,
    context_pct: usage.context && usage.context.percent != null ? usage.context.percent : null,
    updated_at: Math.floor(Date.now() / 1000),
  }
  const path = home + '/.claude/usage.json'
  await $.fs.write(path, JSON.stringify(body, null, 2) + '\n')
  return 'wrote ' + path + ' (5h ' + five.pct + ', 7d ' + seven.pct + ')'
}

// Merges the saved announcement state, so a reload or a second window does not repeat a toast.
// A saved window whose reset time has passed is ignored, so a new day does not open with a reset toast.
async function loadState($) {
  const saved = await $.store.get(STORE_KEY)
  if (!saved || typeof saved !== 'object') return
  for (const [kind] of WINDOWS) {
    const s = saved[kind]
    if (!s || !Number.isFinite(s.ms) || !Number.isFinite(s.fired) || s.ms <= Date.now()) continue
    const cur = state[kind]
    if (!cur || !Number.isFinite(cur.ms) || s.ms > cur.ms) state[kind] = { ms: s.ms, fired: s.fired }
    else if (s.ms === cur.ms && s.fired > cur.fired) cur.fired = s.fired
  }
}

// Toasts each window that has news: a new level, or a window reset. Windows without news stay quiet.
function notify($, rateLimits) {
  for (const [kind, label] of WINDOWS) {
    const w = readWindow(rateLimits, kind)
    if (!w || !shown[kind]) continue
    const prev = state[kind]
    let fired = prev ? prev.fired : 0
    let note = ''
    let news = false

    if (prev && Number.isFinite(w.ms) && Number.isFinite(prev.ms) && w.ms > prev.ms) {
      fired = 0
      note = ' (window reset)'
      news = true
    }

    const crossed = levels.filter((t) => w.pct >= t)
    const level = crossed.length ? crossed[crossed.length - 1] : 0
    if (level > fired) {
      fired = level
      news = true
      if (Number.isFinite(w.ms)) note += ' - resets ' + resetTime(w.ms)
    }

    // Keep the later reset time, so a late, older reading cannot fake a reset on the next one.
    const keepPrev = prev && Number.isFinite(prev.ms) && !(w.ms >= prev.ms)
    state[kind] = { ms: keepPrev ? prev.ms : w.ms, fired }
    if (news) toastEach($, [segment(w.pct, label, note)], fired >= ALERT_AT ? alertMs : normalMs)
  }
}

async function handle($, usage, label) {
  const surfaces = await $.session.surfaces()
  if (!surfaces.includes('vscode')) {
    $.ui.log('redline[' + label + '] skipped: surfaces ' + JSON.stringify(surfaces), { to: 'debug' })
    return
  }

  try {
    const status = await writeUsage($, usage)
    writeFailed = false
    $.ui.log('redline[' + label + '] ' + status, { to: 'debug' })
  } catch (err) {
    $.ui.log('redline[' + label + '] write failed: ' + String(err), { to: 'debug' })
    if (!writeFailed) {
      writeFailed = true
      $.ui.toast(failureText(err), { timeoutMs: alertMs })
    }
  }

  try {
    await loadState($)
  } catch (err) {
    $.ui.log('redline[' + label + '] state load failed: ' + String(err), { to: 'debug' })
  }

  try {
    const before = JSON.stringify(state)
    notify($, usage.rateLimits || [])
    if (JSON.stringify(state) !== before) await $.store.set(STORE_KEY, state)
  } catch (err) {
    $.ui.log('redline[' + label + '] notify failed: ' + String(err), { to: 'debug' })
  }
}

export function register(on, options) {
  normalMs = secondsToMs(options && options.toastSeconds, DEFAULT_TOAST_SECONDS)
  alertMs = secondsToMs(options && options.alertToastSeconds, DEFAULT_ALERT_SECONDS)
  timeFormat = parseTimeFormat(options && options.timeFormat)
  shown.five_hour = isOn(options && options.showFiveHour)
  shown.seven_day = isOn(options && options.showSevenDay)
  levels = [...new Set([...parseLevels(options && options.levels), ALERT_AT])].sort((a, b) => a - b)

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'redline', description: 'Show your current 5-hour and 7-day usage' })
    } catch (err) {
      $.ui.log('redline[start] could not add /redline: ' + String(err), { to: 'debug' })
    }
    return next(e)
  })

  on('command.run', { command: 'redline' }, async ($) => {
    try {
      toastEach($, summary((await $.session.usage()).rateLimits), normalMs)
      return {}
    } catch (err) {
      return { text: 'Could not show usage: ' + String(err) }
    }
  })

  on('session.measure', async ($, e, next) => {
    try {
      await handle($, e, 'measure:' + (e.changed || []).join(','))
    } catch (err) {
      $.ui.log('redline[measure] failed: ' + String(err), { to: 'debug' })
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    try {
      await handle($, await $.session.usage(), 'turn')
    } catch (err) {
      $.ui.log('redline[turn] failed: ' + String(err), { to: 'debug' })
    }
    return next(e)
  })
}