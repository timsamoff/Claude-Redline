// Reads structural signals out of register.js and plugin.json, and decides which documents a change requires.

export function stripComments(src) {
  return src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/[ \t]\/\/ .*$/gm, '')
}

const uniq = (xs) => [...new Set(xs)].sort()

export function registerSignals(src) {
  if (src == null) return { present: false, constants: {}, events: [], calls: [], namespaces: [], uiMethods: [], bodyKeys: [], writePath: '', surfaceRule: '', thresholds: 0, toastCalls: 0, helpers: '' }
  const code = stripComments(src)
  const constants = {}
  for (const m of code.matchAll(/^const ([A-Z][A-Z0-9_]*) = (.*)$/gm)) constants[m[1]] = m[2].trim()
  const calls = uniq([...code.matchAll(/\$\.([a-z]+)\.([A-Za-z]+)/g)].map((m) => `${m[1]}.${m[2]}`))
  const body = (code.match(/const body = \{([\s\S]*?)\n  \}/) || [])[1] || ''
  const helpers = ['segment', 'failureText', 'icon']
    .map((n) => (code.match(new RegExp(`function ${n}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`)) || [''])[0])
    .join('\n')
  return {
    present: true,
    constants,
    events: uniq([...code.matchAll(/\bon\('([^']+)'/g)].map((m) => m[1])),
    calls,
    namespaces: uniq(calls.map((c) => c.split('.')[0])),
    uiMethods: uniq(calls.filter((c) => c.startsWith('ui.')).map((c) => c.slice(3))),
    bodyKeys: uniq([...body.matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1])),
    writePath: ((code.match(/const path = (.+)$/m) || [])[1] || '').trim(),
    surfaceRule: ((code.match(/surfaces\.includes\(([^)]*)\)/) || [])[1] || '').trim(),
    thresholds: (constants.DEFAULT_LEVELS || '').split(',').filter((s) => s.replace(/[\[\]\s]/g, '')).length,
    toastCalls: (code.match(/\$\.ui\.toast\(/g) || []).length,
    helpers,
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error(`${label} is not valid JSON (${e.message})`)
  }
}

export function pluginSignals(text) {
  if (text == null) return { present: false, name: '', description: '', userConfig: {} }
  const j = parseJson(text, 'claude-redline/.claude-plugin/plugin.json')
  return { present: true, name: j.name || '', description: j.description || '', userConfig: j.userConfig || {} }
}

export function marketplaceSignals(text) {
  if (text == null) return { present: false, name: '', plugins: [] }
  const j = parseJson(text, '.claude-plugin/marketplace.json')
  return { present: true, name: j.name || '', plugins: (j.plugins || []).map((p) => p.name) }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const diffSets = (a, b) => ({ added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)) })
const listChange = (label, a, b) => {
  const d = diffSets(a, b)
  const bits = [...d.added.map((x) => `+${x}`), ...d.removed.map((x) => `-${x}`)]
  return bits.length ? `${label} (${bits.join(', ')})` : null
}

function constantChanges(rb, ra) {
  const names = uniq([...Object.keys(rb.constants), ...Object.keys(ra.constants)])
  return names.filter((n) => rb.constants[n] !== ra.constants[n])
}

function userConfigChanges(pb, pa) {
  const keys = uniq([...Object.keys(pb.userConfig), ...Object.keys(pa.userConfig)])
  return keys.filter((k) => !same(pb.userConfig[k], pa.userConfig[k]))
}

function lineOf(text, needle) {
  if (!text || !needle) return undefined
  const i = text.split('\n').findIndex((l) => l.includes(needle))
  return i < 0 ? undefined : i + 1
}

// Decides which documents a change requires. Returns one reason list per document.
export function gateReasons({ before, after, changes, rules }) {
  const P = rules.paths
  const rb = registerSignals(before.text(P.register))
  const ra = registerSignals(after.text(P.register))
  const pb = pluginSignals(before.text(P.plugin))
  const pa = pluginSignals(after.text(P.plugin))
  const mb = marketplaceSignals(before.text(P.marketplace))
  const ma = marketplaceSignals(after.text(P.marketplace))
  const regText = after.text(P.register) || before.text(P.register)
  const claude = []
  const readme = []
  const design = []
  const push = (list, reason, file, needle) => list.push({ reason, file, line: lineOf(regText, needle) })

  const consts = constantChanges(rb, ra)
  if (consts.length) {
    push(claude, `named constants (${consts.join(', ')})`, P.register, `const ${consts[0]} `)
    if (consts.some((n) => /^(DEFAULT_LEVELS|ALERT_AT)$/.test(n))) push(readme, 'the toast levels', P.register, `const ${consts.find((n) => /^(DEFAULT_LEVELS|ALERT_AT)$/.test(n))} `)
    if (consts.some((n) => /^(GREEN|YELLOW|RED|WARN|NBSP|SEPARATOR)$/.test(n))) push(readme, 'the toast text or icons', P.register, `const ${consts.find((n) => /^(GREEN|YELLOW|RED|WARN|NBSP|SEPARATOR)$/.test(n))} `)
  }
  if (rb.helpers !== ra.helpers && rb.present && ra.present) push(readme, 'the toast text helpers', P.register, 'function segment')

  const ev = listChange('hooked events', rb.events, ra.events)
  if (ev) { push(claude, ev, P.register, "on('"); push(design, ev, P.register, "on('") }
  const calls = listChange('the $ calls', rb.calls, ra.calls)
  if (calls) { push(claude, calls, P.register, '$.'); push(readme, `${calls}, which the README quotes from the validator`, P.register, '$.') }
  const ns = listChange('a new kind of capability, meaning $ namespaces', rb.namespaces, ra.namespaces)
  if (ns) push(design, ns, P.register, '$.')
  const surf = listChange('a new place to show output, meaning $.ui methods', rb.uiMethods.filter((m) => !['toast', 'log'].includes(m)), ra.uiMethods.filter((m) => !['toast', 'log'].includes(m)))
  if (surf) push(design, surf, P.register, '$.ui.')
  if (!same(rb.bodyKeys, ra.bodyKeys)) { push(claude, 'the usage.json keys', P.register, 'const body'); push(design, 'the usage.json format', P.register, 'const body'); push(readme, 'the usage.json format', P.register, 'const body') }
  if (rb.writePath !== ra.writePath) push(design, 'where usage.json is written', P.register, 'const path')
  if (rb.surfaceRule !== ra.surfaceRule) push(design, 'when usage.json is written (the surface rule)', P.register, 'surfaces.includes')
  if (rb.thresholds !== ra.thresholds) push(design, 'the number of toast levels', P.register, 'const DEFAULT_LEVELS')
  if (rb.toastCalls !== ra.toastCalls) push(design, 'the number of kinds of toast', P.register, '$.ui.toast(')

  const uc = userConfigChanges(pb, pa)
  if (uc.length) {
    claude.push({ reason: `the userConfig options (${uc.join(', ')})`, file: P.plugin })
    readme.push({ reason: `the settings (${uc.join(', ')})`, file: P.plugin })
  }
  if (pb.name !== pa.name) { claude.push({ reason: 'the plugin name', file: P.plugin }); readme.push({ reason: 'the plugin name', file: P.plugin }) }
  if (pb.description !== pa.description) readme.push({ reason: 'the plugin description', file: P.plugin })
  if (!same(mb, ma)) readme.push({ reason: 'the marketplace file (install steps)', file: P.marketplace })

  const touched = (p) => changes.some((c) => c.path === p)
  if (changes.some((c) => (c.status === 'A' || c.status === 'D') && c.path.startsWith(P.pluginDir + '/'))) {
    claude.push({ reason: 'the plugin folder layout (a file was added or removed)', file: P.pluginDir })
  }
  if (touched(P.license)) readme.push({ reason: 'the license', file: P.license })
  return { claude, readme, design }
}

const DOCS = [
  ['claude', 'G1', 'CLAUDE.md', 'Update the matching rule or section in CLAUDE.md, or split the change.'],
  ['readme', 'G2', 'README.md', 'Update the matching section in README.md, or split the change.'],
  ['design', 'G3', 'DESIGN.md', 'Update the matching section in DESIGN.md, or split the change.'],
]

export function evaluateGates(ctx) {
  const reasons = gateReasons(ctx)
  const staged = new Set(ctx.changes.map((c) => c.path))
  const out = []
  for (const [k, rule, doc, fix] of DOCS) {
    const list = reasons[k]
    if (!list.length || staged.has(ctx.rules.paths[k === 'claude' ? 'claude' : k === 'readme' ? 'readme' : 'design'])) continue
    const first = list[0]
    out.push({
      rule,
      file: first.file,
      line: first.line,
      key: `${doc}:${list.map((r) => r.reason).join('|')}`,
      message: `This commit changes ${list.map((r) => r.reason).join('; ')}, so ${doc} must be updated in the same commit. (This check confirms the file is in the commit, not that its prose is right.)`,
      fix,
    })
  }
  return out
}
