// Claude-Redline: writes ~/.claude/usage.json and shows usage toasts in VS Code sessions.
// Routine results go to the debug log, and CLAUDE.md and DESIGN.md hold the format and toast rules.

// Toast levels, in percent used. The icons and the rules below follow these.
const NOTICE_AT = 70
const RESET_TIME_AT = 90
const ALERT_AT = 95
const THRESHOLDS = [NOTICE_AT, RESET_TIME_AT, ALERT_AT]
const WINDOWS = [['five_hour', '5h'], ['seven_day', '7d']]
const GREEN = '\u{1F7E2}'
const YELLOW = '\u{1F7E1}'
const RED = '\u{1F534}'
const WARN = '\u26A0\uFE0F'
const NBSP = '\u00A0'
const SEPARATOR = ' | '

// Toast durations in seconds. Keep in step with userConfig in plugin.json.
const DEFAULT_TOAST_SECONDS = 6
const DEFAULT_ALERT_SECONDS = 10
const MIN_SECONDS = 1
const MAX_SECONDS = 120

// Per window: { ms: reset time in ms, fired: highest threshold already toasted }.
const state = { five_hour: null, seven_day: null }
let writeFailed = false

// Toast durations in ms. Replaced from userConfig in register().
let normalMs = DEFAULT_TOAST_SECONDS * 1000
let alertMs = DEFAULT_ALERT_SECONDS * 1000

function secondsToMs(value, fallbackSeconds) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallbackSeconds * 1000
  return Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS) * 1000
}

// Preview: when the previewToasts option is on, shows each toast style once on the
// first turn after a restart, so the look and timing can be checked without waiting
// for a real threshold. Set from userConfig in register().
let demoOn = false
let demoShown = false

function icon(pct) {
  if (pct >= ALERT_AT) return RED
  if (pct >= NOTICE_AT) return YELLOW
  return GREEN
}

function resetTime(ms) {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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

// Non-breaking spaces keep the icon, label and percent together when a toast wraps.
function segment(pct, label, note) {
  return icon(pct) + NBSP + label + NBSP + pct + '%' + (note || '')
}

function failureText(err) {
  return WARN + ' usage.json write failed: ' + String(err)
}

async function homeDir($) {
  const home = await $.env.get('HOME')
  if (home) return home
  return await $.env.get('USERPROFILE')
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

// One toast per reading, covering both windows, only when something new happened.
function notify($, rateLimits) {
  const segments = []
  let show = false
  let longest = normalMs

  for (const [kind, label] of WINDOWS) {
    const w = readWindow(rateLimits, kind)
    if (!w) continue
    const prev = state[kind]
    let fired = prev ? prev.fired : 0
    let note = ''

    if (prev && Number.isFinite(w.ms) && Number.isFinite(prev.ms) && w.ms > prev.ms) {
      fired = 0
      note = ' (window reset)'
      show = true
    }

    const crossed = THRESHOLDS.filter((t) => w.pct >= t)
    const level = crossed.length ? crossed[crossed.length - 1] : 0
    if (level > fired) {
      fired = level
      show = true
      if (level >= RESET_TIME_AT && Number.isFinite(w.ms)) note += ' resets ' + resetTime(w.ms)
      if (level >= ALERT_AT) longest = alertMs
    }

    state[kind] = { ms: w.ms, fired }
    segments.push(segment(w.pct, label, note))
  }

  if (show) $.ui.toast(segments.join(SEPARATOR), { timeoutMs: longest })
}

function demo($) {
  const soon = ' resets ' + resetTime(Date.now() + 3600000)
  const sevenDay = segment(32, '7d')
  const samples = [
    [segment(41, '5h') + SEPARATOR + sevenDay, normalMs],
    [segment(72, '5h') + SEPARATOR + sevenDay, normalMs],
    [segment(91, '5h', soon) + SEPARATOR + sevenDay, normalMs],
    [segment(96, '5h', soon) + SEPARATOR + sevenDay, alertMs],
    [segment(3, '5h', ' (window reset)') + SEPARATOR + sevenDay, normalMs],
    [failureText(new Error('EACCES')), alertMs],
  ]
  for (const [text, ms] of samples) $.ui.toast('DEMO ' + text, { timeoutMs: ms })
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
    notify($, usage.rateLimits || [])
  } catch (err) {
    $.ui.log('redline[' + label + '] notify failed: ' + String(err), { to: 'debug' })
  }
}

export function register(on, options) {
  normalMs = secondsToMs(options && options.toastSeconds, DEFAULT_TOAST_SECONDS)
  alertMs = secondsToMs(options && options.alertToastSeconds, DEFAULT_ALERT_SECONDS)
  demoOn = options != null && ['on', 'true'].includes(String(options.previewToasts).toLowerCase())

  on('session.measure', async ($, e, next) => {
    try {
      await handle($, e, 'measure:' + e.changed.join(','))
    } catch (err) {
      $.ui.log('redline[measure] failed: ' + String(err), { to: 'debug' })
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    try {
      if (demoOn && !demoShown) {
        demoShown = true
        demo($)
      }
      await handle($, await $.session.usage(), 'turn')
    } catch (err) {
      $.ui.log('redline[turn] failed: ' + String(err), { to: 'debug' })
    }
    return next(e)
  })
}