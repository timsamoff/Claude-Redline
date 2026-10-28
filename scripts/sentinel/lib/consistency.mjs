// Checks that must hold for a whole tree: defaults, bare numbers, toast text, plugin ID, icon and README content.
import { stripComments, registerSignals } from './signals.mjs'

const viol = (rule, file, line, key, message, fix) => ({ rule, file, line, key, message, fix })
const unable = (rule, file, why) =>
  viol(rule, file, undefined, `unable:${why}`, `Unable to verify: ${why}.`, 'Fix the underlying problem so the check can run. A check that cannot run is not a pass.')

function num(src, name) {
  const m = src.match(new RegExp(`^const ${name} = (\\d+(?:\\.\\d+)?)[ \\t]*$`, 'm'))
  return m ? Number(m[1]) : null
}

function readJson(tree, path, rule) {
  const t = tree.text(path)
  if (t == null) return { error: unable(rule, path, `${path} is missing`) }
  try {
    return { value: JSON.parse(t) }
  } catch {
    return { error: unable(rule, path, `${path} is not valid JSON`) }
  }
}

// K1: the userConfig defaults and limits equal the duration constants in register.js.
export function checkDefaults(tree, rules) {
  const P = rules.paths
  const reg = tree.text(P.register)
  if (reg == null) return [unable('K1', P.register, `${P.register} is missing`)]
  const pj = readJson(tree, P.plugin, 'K1')
  if (pj.error) return [pj.error]
  const want = {}
  for (const n of ['DEFAULT_TOAST_SECONDS', 'DEFAULT_ALERT_SECONDS', 'MIN_SECONDS', 'MAX_SECONDS']) {
    want[n] = num(reg, n)
    if (want[n] == null) return [unable('K1', P.register, `the constant ${n} was not found in register.js`)]
  }
  const uc = pj.value.userConfig || {}
  const pairs = [
    ['toastSeconds', 'default', 'DEFAULT_TOAST_SECONDS'],
    ['alertToastSeconds', 'default', 'DEFAULT_ALERT_SECONDS'],
    ['toastSeconds', 'min', 'MIN_SECONDS'],
    ['alertToastSeconds', 'min', 'MIN_SECONDS'],
    ['toastSeconds', 'max', 'MAX_SECONDS'],
    ['alertToastSeconds', 'max', 'MAX_SECONDS'],
  ]
  const out = []
  for (const [k, field, c] of pairs) {
    const got = uc[k] ? uc[k][field] : undefined
    if (got !== want[c]) out.push(viol('K1', P.plugin, undefined, `${k}.${field}`, `plugin.json ${k}.${field} is ${got === undefined ? 'missing' : got}, but ${c} in register.js is ${want[c]}.`, `Make them equal. A JSON file cannot import the constant, so change both.`))
  }
  return out
}

// K2: no bare number for a threshold or a toast duration outside the constants that define them.
export function checkBareNumbers(tree, rules) {
  const P = rules.paths
  const reg = tree.text(P.register)
  if (reg == null) return [unable('K2', P.register, `${P.register} is missing`)]
  const banned = new Map()
  for (const n of ['NOTICE_AT', 'RESET_TIME_AT', 'ALERT_AT', 'MAX_SECONDS']) {
    const x = num(reg, n)
    if (x == null) return [unable('K2', P.register, `the constant ${n} was not found in register.js`)]
    banned.set(x, n)
  }
  for (const n of ['DEFAULT_TOAST_SECONDS', 'DEFAULT_ALERT_SECONDS']) {
    const x = num(reg, n)
    if (x == null) return [unable('K2', P.register, `the constant ${n} was not found in register.js`)]
    banned.set(x * 1000, n)
  }
  const out = []
  stripComments(reg).split('\n').forEach((raw, i) => {
    if (/^const [A-Z][A-Z0-9_]* = /.test(raw)) return
    const line = raw.replace(/'(?:[^'\\]|\\.)*'/g, "''")
    for (const m of line.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g)) {
      const x = Number(m[0])
      if (banned.has(x)) out.push(viol('K2', P.register, i + 1, `${raw.trim()}|${x}`, `The bare number ${x} on this line should be the constant ${banned.get(x)}.`, `Use ${banned.get(x)} so the value has one source.`))
    }
  })
  return out
}

function firstArg(code, start) {
  let depth = 0
  let quote = null
  for (let i = start; i < code.length; i++) {
    const ch = code[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) {
      if (depth === 0) return code.slice(start, i)
      depth--
    } else if (ch === ',' && depth === 0) return code.slice(start, i)
  }
  return code.slice(start)
}

// K3: every toast gets its text from the shared helpers, never from a typed string.
export function checkToasts(tree, rules) {
  const P = rules.paths
  const reg = tree.text(P.register)
  if (reg == null) return [unable('K3', P.register, `${P.register} is missing`)]
  const code = stripComments(reg)
  const out = []
  const call = '$.ui.toast('
  for (let idx = code.indexOf(call); idx !== -1; idx = code.indexOf(call, idx + call.length)) {
    const arg = firstArg(code, idx + call.length).trim()
    if (!/^(segments\.join\(|failureText\(|'DEMO ' \+ text$)/.test(arg)) {
      out.push(viol('K3', P.register, code.slice(0, idx).split('\n').length, `toast:${arg}`, `This toast takes its text from "${arg}", not from segment() or failureText().`, 'Build toast text only through segment() and failureText().'))
    }
  }
  const demo = (code.match(/function demo\([^)]*\) \{[\s\S]*?\n\}/) || [])[0]
  if (demo) {
    for (const row of demo.split('\n')) {
      const m = row.match(/^\s*\[(.*), (?:normalMs|alertMs)\],?\s*$/)
      if (m && !/segment\(|failureText\(/.test(m[1])) {
        out.push(viol('K3', P.register, undefined, `demo:${row.trim()}`, `A preview sample is built by hand: ${row.trim()}`, 'Build preview samples with segment() or failureText() so they cannot drift from the real format.'))
      }
    }
  }
  return out
}

// K6: the plugin ID is the same in plugin.json, the marketplace entry, the README and CLAUDE.md.
export function checkIds(tree, rules) {
  const P = rules.paths
  const pj = readJson(tree, P.plugin, 'K6')
  if (pj.error) return [pj.error]
  const name = pj.value.name
  const out = []
  if (tree.has(P.marketplace)) {
    const mk = readJson(tree, P.marketplace, 'K6')
    if (mk.error) return [mk.error]
    const names = (mk.value.plugins || []).map((p) => p.name)
    if (!names.includes(name)) out.push(viol('K6', P.marketplace, undefined, `entry:${names.join(',')}`, `The marketplace entry names are [${names.join(', ')}], but plugin.json says "${name}".`, 'Make the entry name equal the manifest name, or installs by name fail.'))
    const readme = tree.text(P.readme)
    const m = readme && readme.match(/claude plugin install ([\w.-]+)@([\w.-]+)/)
    if (m && (m[1] !== name || m[2] !== mk.value.name)) out.push(viol('K6', P.readme, undefined, `install:${m[1]}@${m[2]}`, `The README installs "${m[1]}@${m[2]}", but the plugin is "${name}" in marketplace "${mk.value.name}".`, 'Fix the README install command.'))
  }
  const claude = tree.text(P.claude)
  const c = claude && claude.match(/claude plugin install ([\w.-]+)@/)
  if (c && c[1] !== name) out.push(viol('K6', P.claude, undefined, `install:${c[1]}`, `CLAUDE.md installs "${c[1]}", but the plugin is "${name}".`, 'Fix the CLAUDE.md install command.'))
  return out
}

// K8: if the plugin folder has an icon, it meets the directory's rules. No icon passes (a known gap, tracked in TODO V2).
export function checkIcon(tree, rules) {
  const P = rules.paths
  const pj = readJson(tree, P.plugin, 'K8')
  if (pj.error) return [pj.error]
  const base = P.pluginDir + '/'
  const named = pj.value.icon ? base + String(pj.value.icon).replace(/^\.\//, '') : null
  const path = [named, ...['.claude-plugin/icon.png', '.claude-plugin/icon.svg', 'assets/icon.png', 'assets/icon.svg'].map((p) => base + p)].find((p) => p && tree.has(p))
  if (!path) return []
  const lim = rules.icon
  if (/\.(svg|webp)$/i.test(path)) return [viol('K8', path, undefined, `format:${path}`, 'The directory does not accept SVG or WebP icons.', 'Use a square PNG or JPEG.')]
  const buf = tree.buffer(path)
  const out = []
  if (buf.length > lim.maxBytes) out.push(viol('K8', path, undefined, 'size', `The icon is ${buf.length} bytes. The limit is ${lim.maxBytes}.`, 'Shrink it to under 2 MB.'))
  if (/\.png$/i.test(path)) {
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return [...out, viol('K8', path, undefined, 'png', 'The file is not a valid PNG.', 'Re-export the icon as a PNG.')]
    const w = buf.readUInt32BE(16)
    const h = buf.readUInt32BE(20)
    if (w !== h) out.push(viol('K8', path, undefined, 'square', `The icon is ${w} by ${h}. It must be square.`, 'Export a square image.'))
    if (w < lim.minPx || w > lim.maxPx) out.push(viol('K8', path, undefined, 'dimensions', `The icon is ${w} px wide. It must be ${lim.minPx} to ${lim.maxPx}.`, 'Export at 512 to 2048 px.'))
  }
  return out
}

// R1: the README still contains the phrases the project's features and settings depend on.
export function checkReadme(tree, rules) {
  const P = rules.paths
  const readme = tree.text(P.readme)
  if (readme == null) return [viol('R1', P.readme, undefined, 'missing', 'README.md is missing.', 'Restore it.')]
  const out = []
  const need = (phrase, why) => {
    if (!readme.includes(phrase)) out.push(viol('R1', P.readme, undefined, `phrase:${phrase}`, `The README no longer contains "${phrase}" (${why}).`, 'Restore it. This check confirms the phrase is present, not that the prose around it is accurate.'))
  }
  for (const p of rules.readme.static) need(p, 'a required phrase')
  const pj = readJson(tree, P.plugin, 'R1')
  if (pj.error) return [...out, pj.error]
  for (const o of Object.values(pj.value.userConfig || {})) if (o.title) need(o.title, 'a setting title from plugin.json')
  const reg = tree.text(P.register)
  if (reg == null) return [...out, unable('R1', P.register, `${P.register} is missing`)]
  for (const n of ['NOTICE_AT', 'RESET_TIME_AT', 'ALERT_AT']) {
    const x = num(reg, n)
    if (x == null) { out.push(unable('R1', P.register, `the constant ${n} was not found in register.js`)); continue }
    if (!new RegExp(`(?<!\\d)${x}\\s?(%|percent)`).test(readme)) out.push(viol('R1', P.readme, undefined, `level:${x}`, `The README does not mention the ${x} percent level (${n}).`, `Document the ${x} percent level, written as "${x}%" or "${x} percent".`))
  }
  for (const k of registerSignals(reg).bodyKeys) need(k, 'a usage.json key from register.js')
  return out
}
