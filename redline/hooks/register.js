// Redline probe. Observes only: logs usage to the transcript and fires one toast.
// Writes no files. Answers: do rate limits reach a mod in VS Code, do toasts draw,
// and what does $.session.surfaces() report?

function summarize(rateLimits) {
  if (!rateLimits || rateLimits.length === 0) return 'no rate-limit windows'
  return rateLimits.map((w) => w.kind + ' ' + w.percentUsed + '% (resets ' + w.resetsAt + ')').join(' | ')
}

function toastText(rateLimits) {
  const five = rateLimits.find((w) => w.kind === 'five_hour')
  const seven = rateLimits.find((w) => w.kind === 'seven_day')
  return 'Redline probe: 5h ' + (five ? five.percentUsed + '%' : '?') + ' / 7d ' + (seven ? seven.percentUsed + '%' : '?')
}

async function probe($, label, rateLimits) {
  try {
    const surfaces = await $.session.surfaces()
    $.ui.log('redline[' + label + '] ' + summarize(rateLimits) + ' | surfaces: ' + JSON.stringify(surfaces))
    $.ui.toast(toastText(rateLimits), { timeoutMs: 8000 })
  } catch (err) {
    $.ui.log('redline[' + label + '] probe failed: ' + String(err))
  }
}

export function register(on) {
  on('session.measure', async ($, e, next) => {
    await probe($, 'measure:' + e.changed.join(','), e.rateLimits)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const usage = await $.session.usage()
    await probe($, 'turn', usage.rateLimits)
    return next(e)
  })
}
