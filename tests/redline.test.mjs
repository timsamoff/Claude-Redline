// Runs register.js against a fake $. Run with: node --test tests/redline.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SOURCE = readFileSync(new URL('../claude-redline/hooks/register.js', import.meta.url), 'utf8')
let loads = 0

// A fresh module per call, so the state inside register.js does not leak between tests.
async function load(options) {
  const url = 'data:text/javascript;base64,' + Buffer.from(SOURCE + `\n// load ${loads++}\n`).toString('base64')
  const handlers = []
  const mod = await import(url)
  mod.register((event, a, b) => handlers.push(b ? { event, match: a, fn: b } : { event, fn: a }), options)
  return handlers
}

// A fake $. Pass the same store to two fakes to stand in for a reload or a second window.
function fake({ surfaces = ['vscode'], usage = { rateLimits: [] }, store = new Map(), env = { HOME: '/home/t' } } = {}) {
  const toasts = []
  const writes = []
  const commands = []
  const $ = {
    env: { get: async (k) => env[k] },
    fs: { write: async (path, body) => writes.push({ path, body }) },
    session: { surfaces: async () => surfaces, usage: async () => usage },
    command: { register: async (c) => commands.push(c) },
    store: { get: async (k) => (store.has(k) ? JSON.parse(store.get(k)) : undefined), set: async (k, v) => { store.set(k, JSON.stringify(v)) } },
    ui: { toast: (text, o) => toasts.push({ text, ms: o.timeoutMs }), log: () => {} },
  }
  return { $, toasts, writes, commands, store }
}

const FUTURE = '2030-01-01T12:00:00Z'
const limits = (five, seven, resetsAt = FUTURE) => [
  { kind: 'five_hour', percentUsed: five, resetsAt },
  { kind: 'seven_day', percentUsed: seven, resetsAt },
]
const find = (hs, event) => hs.find((h) => h.event === event)
const turn = (hs, f, usage) => { f.$.session.usage = async () => usage; return find(hs, 'turn.complete').fn(f.$, {}, async (e) => e) }
const command = (hs, f) => find(hs, 'command.run').fn(f.$)
const texts = (f) => f.toasts.map((t) => t.text)

test('usage.json keeps the status line contract', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: limits(41, 32), context: { percent: 12 } })
  const body = JSON.parse(f.writes[0].body)
  assert.equal(f.writes[0].path, '/home/t/.claude/usage.json')
  assert.equal(body.five_hour_pct, 41)
  assert.equal(body.five_hour_resets_at, String(Date.parse(FUTURE) / 1000))
  assert.equal(body.context_pct, 12)
  assert.equal(typeof body.updated_at, 'number')
})

test('USERPROFILE wins over HOME, since HOME can be a Git Bash path on Windows', async () => {
  const hs = await load({})
  const f = fake({ env: { HOME: '/c/Users/t', USERPROFILE: 'C:\\Users\\t' } })
  await turn(hs, f, { rateLimits: limits(41, 32) })
  assert.equal(f.writes[0].path, 'C:\\Users\\t/.claude/usage.json')
})

test('a missing window is null and an empty reset time', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: [{ kind: 'five_hour', percentUsed: 5, resetsAt: FUTURE }] })
  const body = JSON.parse(f.writes[0].body)
  assert.equal(body.seven_day_pct, null)
  assert.equal(body.seven_day_resets_at, '')
})

test('no write when neither window exists, and none outside VS Code', async () => {
  const hs = await load({})
  const none = fake()
  await turn(hs, none, { rateLimits: [{ kind: 'spend_limit', percentUsed: 50 }] })
  assert.equal(none.writes.length, 0)
  const cli = fake({ surfaces: ['cli'] })
  await turn(hs, cli, { rateLimits: limits(80, 10) })
  assert.equal(cli.writes.length, 0)
})

test('each default level toasts once, and 95 gets the alert duration', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: limits(41, 32) })
  assert.equal(f.toasts.length, 0)
  await turn(hs, f, { rateLimits: limits(72, 32) })
  await turn(hs, f, { rateLimits: limits(73, 32) })
  assert.equal(f.toasts.length, 1)
  await turn(hs, f, { rateLimits: limits(91, 32) })
  await turn(hs, f, { rateLimits: limits(96, 32) })
  assert.equal(f.toasts.length, 3)
  assert.equal(f.toasts.at(-1).ms, 10000)
})

test('only the window with news gets a toast', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: limits(72, 32) })
  assert.deepEqual(texts(f).map((t) => t.includes('5h')), [true])
})

test('a later reset time announces the window reset', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: [{ kind: 'five_hour', percentUsed: 96, resetsAt: '2030-01-01T12:00:00Z' }] })
  await turn(hs, f, { rateLimits: [{ kind: 'five_hour', percentUsed: 2, resetsAt: '2030-01-01T17:00:00Z' }] })
  assert.equal(f.toasts.length, 2)
  assert.match(f.toasts[1].text, /window reset/)
})

test('a late, older reading does not fake a reset on the next one', async () => {
  const hs = await load({})
  const f = fake()
  const at = (pct, resetsAt) => ({ rateLimits: [{ kind: 'five_hour', percentUsed: pct, resetsAt }] })
  await turn(hs, f, at(10, '2030-01-01T17:00:00Z'))
  await turn(hs, f, at(10, '2030-01-01T12:00:00Z'))
  await turn(hs, f, at(10, '2030-01-01T17:00:00Z'))
  assert.equal(f.toasts.length, 0)
})

test('custom levels replace the defaults', async () => {
  const hs = await load({ levels: '50, 80' })
  const f = fake()
  await turn(hs, f, { rateLimits: limits(55, 10) })
  assert.equal(f.toasts.length, 1)
  await turn(hs, f, { rateLimits: limits(82, 10) })
  assert.equal(f.toasts.length, 2)
  assert.equal(f.toasts.at(-1).ms, 6000)
})

test('levels typed with percent signs still work', async () => {
  const hs = await load({ levels: '50%, 80%' })
  const f = fake()
  await turn(hs, f, { rateLimits: limits(55, 10) })
  assert.equal(f.toasts.length, 1)
})

test('95 always toasts with the alert duration, whatever levels are set', async () => {
  for (const levels of ['99', '10, 20, 30, 40, 50', undefined]) {
    const hs = await load({ levels })
    const f = fake()
    await turn(hs, f, { rateLimits: limits(96, 10) })
    assert.equal(f.toasts.find((t) => t.text.includes('5h')).ms, 10000, `levels ${levels}`)
  }
})

test('an invalid levels setting falls back to the defaults', async () => {
  for (const bad of ['', 'abc', '0, 500', undefined]) {
    const hs = await load({ levels: bad })
    const f = fake()
    await turn(hs, f, { rateLimits: limits(60, 10) })
    assert.equal(f.toasts.length, 0, `levels ${JSON.stringify(bad)}`)
    await turn(hs, f, { rateLimits: limits(71, 10) })
    assert.equal(f.toasts.length, 1, `levels ${JSON.stringify(bad)}`)
  }
})

test('/redline registers on session start and shows one toast per window', async () => {
  const hs = await load({})
  const f = fake({ usage: { rateLimits: limits(41, 32) } })
  await find(hs, 'session.start').fn(f.$, {}, async (e) => e)
  assert.equal(f.commands[0].name, 'redline')
  assert.deepEqual(find(hs, 'command.run').match, { command: 'redline' })
  const result = await command(hs, f)
  assert.equal(result.text, undefined)
  assert.equal(f.toasts.length, 2)
  assert.match(f.toasts[0].text, /5h:.41% - resets/)
  assert.match(f.toasts[1].text, /7d:.32% - resets/)
})

test('/redline says so when there is no data', async () => {
  const hs = await load({})
  const f = fake({ usage: { rateLimits: [] } })
  await command(hs, f)
  assert.match(f.toasts[0].text, /No usage data yet/)
})

test('icon colors use fixed cutoffs, not the levels setting', async () => {
  const hs = await load({ levels: '10' })
  const shown = async (p) => {
    const g = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: p, resetsAt: FUTURE }] } })
    await command(hs, g)
    return g.toasts[0].text
  }
  assert.match(await shown(58), /^\u{1F7E2}/u)
  assert.match(await shown(59), /^\u{1F7E1}/u)
  assert.match(await shown(88), /^\u{1F7E1}/u)
  assert.match(await shown(89), /^\u{1F534}/u)
  assert.match(await shown(99), /^\u{1F534}/u)
})

test('a decimal percent is shown rounded down', async () => {
  const hs = await load({})
  const f = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: 94.6, resetsAt: FUTURE }] } })
  await command(hs, f)
  assert.match(f.toasts[0].text, /5h:.94% /)
})

test('a reset on another day names the weekday, even when it is less than a day away', async () => {
  const hs = await load({})
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 30, 0, 0)
  const f = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: 70, resetsAt: tomorrow.toISOString() }] } })
  await command(hs, f)
  assert.match(f.toasts[0].text, /- resets [A-Z][a-z]+day at /)
  const late = new Date()
  late.setHours(23, 59, 0, 0)
  if (late > new Date()) {
    const g = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: 70, resetsAt: late.toISOString() }] } })
    await command(hs, g)
    assert.match(g.toasts[0].text, /- resets at /)
  }
})

test('the timeFormat setting changes how reset times read', async () => {
  const at = '2030-06-01T14:20:00Z'
  const show = async (timeFormat) => {
    const hs = await load({ timeFormat })
    const g = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: 70, resetsAt: at }] } })
    await command(hs, g)
    return g.toasts[0].text
  }
  assert.match(await show('UTC'), /Saturday at 14:20 UTC$/)
  assert.match(await show('24-hour'), /at [0-9]{2}:[0-9]{2}$/)
  assert.match(await show('12-hour'), /(AM|PM|am|pm)$/)
  assert.match(await show('nonsense'), /resets /)
})

test('each show setting turns one window off', async () => {
  const hs = await load({ showFiveHour: 'Off' })
  const f = fake({ usage: { rateLimits: limits(80, 80) } })
  await turn(hs, f, { rateLimits: limits(80, 80) })
  assert.equal(f.toasts.length, 1)
  assert.match(f.toasts[0].text, /7d:/)
  const hs2 = await load({ showSevenDay: 'off' })
  const g = fake({ usage: { rateLimits: limits(80, 80) } })
  await turn(hs2, g, { rateLimits: limits(80, 80) })
  assert.equal(g.toasts.length, 1)
  assert.match(g.toasts[0].text, /5h:/)
  await command(hs2, g)
  assert.equal(g.toasts.length, 2)
})

test('with both windows off there are no toasts, but usage.json is still written', async () => {
  const hs = await load({ showFiveHour: 'Off', showSevenDay: 'Off' })
  const f = fake({ usage: { rateLimits: limits(96, 96) } })
  await turn(hs, f, { rateLimits: limits(96, 96) })
  assert.equal(f.toasts.length, 0)
  assert.equal(f.writes.length, 1)
  const result = await command(hs, f)
  assert.match(f.toasts[0].text, /turned off/)
  assert.equal(result.text, undefined)
})

test('a reload or a second window does not repeat a toast', async () => {
  const store = new Map()
  const first = fake({ store })
  await turn(await load({}), first, { rateLimits: limits(72, 32) })
  assert.equal(first.toasts.length, 1)
  const second = fake({ store })
  await turn(await load({}), second, { rateLimits: limits(72, 32) })
  assert.equal(second.toasts.length, 0)
  await turn(await load({}), second, { rateLimits: limits(91, 32) })
  assert.equal(second.toasts.length, 1)
})

test('saved state for a window that has already reset is ignored', async () => {
  const store = new Map([['windows', JSON.stringify({ five_hour: { ms: Date.parse('2020-01-01T00:00:00Z'), fired: 90 } })]])
  const f = fake({ store })
  await turn(await load({}), f, { rateLimits: limits(72, 32) })
  assert.equal(f.toasts.length, 1)
  assert.doesNotMatch(f.toasts[0].text, /window reset/)
})