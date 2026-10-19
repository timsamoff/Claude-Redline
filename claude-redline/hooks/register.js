// Claude-Redline. In VS Code sessions only:
//  - writes ~/.claude/usage.json in the same format as ~/.claude/statusline.sh
//  - toasts when a rate-limit window crosses 70, 90 or 95 percent (once per window
//    per reset cycle), when a window resets, and once if the write fails.
// Routine results go to the debug log, not the transcript.

const THRESHOLDS = [70, 90, 95]
const WINDOWS = [['five_hour', '5h'], ['seven_day', '7d']]
const GREEN = '\u{1F7E2}'
const YELLOW = '\u{1F7E1}'
const RED = '\u{1F534}'
const WARN = '\u26A0\uFE0F'

// Per window: { ms: reset time in ms, fired: highest threshold already toasted }.
const state = { five_hour: null, seven_day: null }
let writeFailed = false

// TEMPORARY: previews each toast style once, on the first turn after a reload.
// Set DEMO to false (or delete this block and its call) when done.
const DEMO = false
let demoShown = false

function icon(pct) {
  if (pct >= 95) return RED
  if (pct >= 70) return YELLOW
  return GREEN
}

function resetTime(ms) {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch (err) {
    return ''
  }
}

function windowFor(rateLimits, kind) {
  const w = (rateLimits || []).find((r) => r.kind === kind)
  if (!w) return { pct: null, resetsAt: '' }
  const ms = w.resetsAt ? Date.parse(w.resetsAt) : NaN
  return {
    pct: w.percentUsed,
    resetsAt: Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : '',
  }
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
  let longest = 6000

  for (const [kind, label] of WINDOWS) {
    const w = rateLimits.find((r) => r.kind === kind)
    if (!w) continue
    const ms = w.resetsAt ? Date.parse(w.resetsAt) : NaN
    const prev = state[kind]
    let fired = prev ? prev.fired : 0
    let note = ''

    if (prev && Number.isFinite(ms) && Number.isFinite(prev.ms) && ms > prev.ms) {
      fired = 0
      note = ' (window reset)'
      show = true
    }

    const crossed = THRESHOLDS.filter((t) => w.percentUsed >= t)
    const level = crossed.length ? crossed[crossed.length - 1] : 0
    if (level > fired) {
      fired = level
      show = true
      if (level >= 90 && Number.isFinite(ms)) note += ' resets ' + resetTime(ms)
      if (level >= 95) longest = 10000
    }

    state[kind] = { ms, fired }
    segments.push(icon(w.percentUsed) + ' ' + label + ' ' + w.percentUsed + '%' + note)
  }

  if (show) $.ui.toast(segments.join(' | '), { timeoutMs: longest })
}

function demo($) {
  const samples = [
    [GREEN + ' 5h 41% | ' + GREEN + ' 7d 32%', 15000],
    [YELLOW + ' 5h 72% | ' + GREEN + ' 7d 32%', 15000],
    [YELLOW + ' 5h 91% resets ' + resetTime(Date.now() + 3600000) + ' | ' + GREEN + ' 7d 32%', 15000],
    [RED + ' 5h 96% resets ' + resetTime(Date.now() + 3600000) + ' | ' + GREEN + ' 7d 32%', 15000],
    [GREEN + ' 5h 3% (window reset) | ' + GREEN + ' 7d 32%', 15000],
    [WARN + ' usage.json write failed: Error: EACCES', 15000],
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
      $.ui.toast(WARN + ' usage.json write failed: ' + String(err), { timeoutMs: 10000 })
    }
  }

  try {
    notify($, usage.rateLimits || [])
  } catch (err) {
    $.ui.log('redline[' + label + '] notify failed: ' + String(err), { to: 'debug' })
  }
}

export function register(on) {
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
      if (DEMO && !demoShown) {
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