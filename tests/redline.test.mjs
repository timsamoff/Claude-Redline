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

function fake({ surfaces = ['vscode'], usage = { rateLimits: [] } } = {}) {
  const toasts = []
  const writes = []
  const commands = []
  const $ = {
    env: { get: async (k) => (k === 'HOME' ? '/home/t' : undefined) },
    fs: { write: async (path, body) => writes.push({ path, body }) },
    session: { surfaces: async () => surfaces, usage: async () => usage },
    command: { register: async (c) => commands.push(c) },
    ui: { toast: (text, o) => toasts.push({ text, ms: o.timeoutMs }), log: () => {} },
  }
  return { $, toasts, writes, commands }
}

const limits = (five, seven, resetsAt = '2030-01-01T12:00:00Z') => [
  { kind: 'five_hour', percentUsed: five, resetsAt },
  { kind: 'seven_day', percentUsed: seven, resetsAt },
]
const count = (f) => f.toasts.length / 2
const find = (hs, event) => hs.find((h) => h.event === event)
const turn = (hs, f, usage) => { f.$.session.usage = async () => usage; return find(hs, 'turn.complete').fn(f.$, {}, async (e) => e) }

test('usage.json keeps the status line contract', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: limits(41, 32), context: { percent: 12 } })
  const body = JSON.parse(f.writes[0].body)
  assert.equal(f.writes[0].path, '/home/t/.claude/usage.json')
  assert.equal(body.five_hour_pct, 41)
  assert.equal(body.five_hour_resets_at, String(Date.parse('2030-01-01T12:00:00Z') / 1000))
  assert.equal(body.context_pct, 12)
  assert.equal(typeof body.updated_at, 'number')
})

test('a missing window is null and an empty reset time', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: [{ kind: 'five_hour', percentUsed: 5, resetsAt: '2030-01-01T12:00:00Z' }] })
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

test('each default level toasts once', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: limits(41, 32) })
  assert.equal(count(f), 0)
  await turn(hs, f, { rateLimits: limits(72, 32) })
  await turn(hs, f, { rateLimits: limits(73, 32) })
  assert.equal(count(f), 1)
  await turn(hs, f, { rateLimits: limits(91, 32) })
  await turn(hs, f, { rateLimits: limits(96, 32) })
  assert.equal(count(f), 3)
  assert.equal(f.toasts.at(-1).ms, 10000)
})

test('a later reset time announces the window reset', async () => {
  const hs = await load({})
  const f = fake()
  await turn(hs, f, { rateLimits: limits(96, 10, '2030-01-01T12:00:00Z') })
  const before = count(f)
  await turn(hs, f, { rateLimits: limits(2, 10, '2030-01-01T17:00:00Z') })
  assert.equal(count(f), before + 1)
  assert.match(f.toasts.at(-1).text, /window reset/)
})

test('custom levels replace the defaults', async () => {
  const hs = await load({ levels: '50, 80' })
  const f = fake()
  await turn(hs, f, { rateLimits: limits(55, 10) })
  assert.equal(count(f), 1)
  await turn(hs, f, { rateLimits: limits(82, 10) })
  assert.equal(count(f), 2)
  assert.equal(f.toasts.at(-1).ms, 6000)
})

test('95 always toasts with the alert duration, whatever levels are set', async () => {
  for (const levels of ['99', '10, 20, 30, 40, 50', undefined]) {
    const hs = await load({ levels })
    const f = fake()
    await turn(hs, f, { rateLimits: limits(96, 10) })
    assert.equal(f.toasts.at(-1).ms, 10000, `levels ${levels}`)
  }
})

test('an invalid levels setting falls back to the defaults', async () => {
  for (const bad of ['', 'abc', '0, 500', undefined]) {
    const hs = await load({ levels: bad })
    const f = fake()
    await turn(hs, f, { rateLimits: limits(60, 10) })
    assert.equal(count(f), 0, `levels ${JSON.stringify(bad)}`)
    await turn(hs, f, { rateLimits: limits(71, 10) })
    assert.equal(count(f), 1, `levels ${JSON.stringify(bad)}`)
  }
})

test('/redline registers on session start and answers with both windows', async () => {
  const hs = await load({})
  const f = fake({ usage: { rateLimits: limits(41, 32) } })
  await find(hs, 'session.start').fn(f.$, {}, async (e) => e)
  assert.equal(f.commands[0].name, 'redline')
  const run = hs.find((h) => h.event === 'command.run')
  assert.deepEqual(run.match, { command: 'redline' })
  const result = await run.fn(f.$)
  assert.equal(result.text, undefined)
  assert.equal(f.toasts.length, 2)
  assert.match(f.toasts[0].text, /5h:.41% - resets/)
  assert.match(f.toasts[1].text, /7d:.32% - resets/)
})

test('/redline says so when there is no data', async () => {
  const hs = await load({})
  const f = fake({ usage: { rateLimits: [] } })
  await hs.find((h) => h.event === 'command.run').fn(f.$)
  assert.match(f.toasts[0].text, /No usage data yet/)
})

test('icon colors use fixed cutoffs, not the levels setting', async () => {
  const hs = await load({ levels: '10' })
  const text = async (p) => {
    const g = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: p, resetsAt: '2030-01-01T12:00:00Z' }] } })
    await hs.find((h) => h.event === 'command.run').fn(g.$)
    return g.toasts[0].text
  }
  assert.match(await text(58), /^\u{1F7E2}/u)
  assert.match(await text(59), /^\u{1F7E1}/u)
  assert.match(await text(88), /^\u{1F7E1}/u)
  assert.match(await text(89), /^\u{1F534}/u)
  assert.match(await text(99), /^\u{1F534}/u)
})

test('the reset time reads "resets at" soon and "resets <weekday> at" later', async () => {
  const hs = await load({})
  const soon = new Date(Date.now() + 3600000).toISOString()
  const later = new Date(Date.now() + 3 * 86400000).toISOString()
  const g = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: 70, resetsAt: soon }, { kind: 'seven_day', percentUsed: 46, resetsAt: later }] } })
  await hs.find((h) => h.event === 'command.run').fn(g.$)
  const [five, seven] = g.toasts.map((t) => t.text)
  assert.match(five, /5h:.70% - resets at /)
  assert.match(seven, /7d:.46% - resets [A-Z][a-z]+day at /)
})

test('the timeFormat setting changes how reset times read', async () => {
  const at = '2030-06-01T14:20:00Z'
  const show = async (timeFormat) => {
    const hs = await load({ timeFormat })
    const g = fake({ usage: { rateLimits: [{ kind: 'five_hour', percentUsed: 70, resetsAt: at }] } })
    await hs.find((h) => h.event === 'command.run').fn(g.$)
    return g.toasts[0].text
  }
  assert.match(await show('UTC'), /Saturday at 14:20 UTC$/)
  assert.match(await show('24-hour'), /at [0-9]{2}:[0-9]{2}$/)
  assert.match(await show('12-hour'), /(AM|PM|am|pm)$/)
  assert.match(await show('nonsense'), /resets /)
})

test('each show setting turns one window off', async () => {
  const only7 = fake({ usage: { rateLimits: limits(80, 80) } })
  const hs = await load({ showFiveHour: 'Off' })
  await find(hs, 'turn.complete').fn(only7.$, {}, async (e) => e)
  assert.equal(only7.toasts.length, 1)
  assert.match(only7.toasts[0].text, /7d:/)
  const only5 = fake({ usage: { rateLimits: limits(80, 80) } })
  const hs2 = await load({ showSevenDay: 'off' })
  await find(hs2, 'turn.complete').fn(only5.$, {}, async (e) => e)
  assert.equal(only5.toasts.length, 1)
  assert.match(only5.toasts[0].text, /5h:/)
  await hs2.find((h) => h.event === 'command.run').fn(only5.$)
  assert.equal(only5.toasts.length, 2)
})

test('with both windows off there are no toasts, but usage.json is still written', async () => {
  const hs = await load({ showFiveHour: 'Off', showSevenDay: 'Off' })
  const f = fake({ usage: { rateLimits: limits(96, 96) } })
  await find(hs, 'turn.complete').fn(f.$, {}, async (e) => e)
  assert.equal(f.toasts.length, 0)
  assert.equal(f.writes.length, 1)
  const result = await hs.find((h) => h.event === 'command.run').fn(f.$)
  assert.match(f.toasts[0].text, /turned off/)
  assert.equal(result.text, undefined)
})

