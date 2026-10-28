// Runs "claude plugin validate --json" on a copy of a tree and checks the result (K4) and the README quote (K5).
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, dirname } from 'node:path'

const q = (s) => (/[\s"]/.test(s) ? `"${s}"` : s)
const viol = (rule, file, key, message, fix) => ({ rule, file, line: undefined, key, message, fix })

function nativeBinaries() {
  const dir = join(homedir(), '.vscode', 'extensions')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((d) => d.startsWith('anthropic.claude-code-'))
    .sort()
    .reverse()
    .map((d) => join(dir, d, 'resources', 'native-binary', process.platform === 'win32' ? 'claude.exe' : 'claude'))
    .filter((p) => existsSync(p))
}

export function findClaude() {
  const candidates = [process.env.CLAUDE_BIN, 'claude', process.env.APPDATA && join(process.env.APPDATA, 'npm', 'claude.cmd'), ...nativeBinaries()].filter(Boolean)
  for (const c of candidates) {
    const r = spawnSync(`${q(c)} --version`, { shell: true, encoding: 'utf8', timeout: 30000 })
    if (r.status === 0) return c
  }
  throw new Error('the claude command was not found on PATH or in the usual install locations, so the plugin validator could not run')
}

function runValidate(bin, dir) {
  const r = spawnSync(`${q(bin)} plugin validate ${q(dir)} --json`, { shell: true, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 })
  const i = (r.stdout || '').indexOf('{')
  if (i < 0) throw new Error(`the validator printed no JSON for ${dir}: ${String(r.stdout || r.stderr).slice(0, 200)}`)
  return JSON.parse(r.stdout.slice(i))
}

function materialize(tree, rules) {
  const P = rules.paths
  const tmp = mkdtempSync(join(tmpdir(), 'sentinel-'))
  for (const p of tree.list()) {
    if (!(p.startsWith(P.pluginDir + '/') || p === P.marketplace)) continue
    const buf = tree.buffer(p)
    if (buf == null) continue
    mkdirSync(dirname(join(tmp, p)), { recursive: true })
    writeFileSync(join(tmp, p), buf)
  }
  return tmp
}

const messages = (list) => (list || []).map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))
const collapse = (s) => s.replace(/\s+/g, ' ').trim()

export function validateTree(tree, rules) {
  const P = rules.paths
  const bin = findClaude()
  const tmp = materialize(tree, rules)
  const out = []
  try {
    const reports = [['plugin', runValidate(bin, join(tmp, P.pluginDir)), P.pluginDir]]
    if (tree.has(P.marketplace)) reports.push(['marketplace', runValidate(bin, tmp), P.marketplace])
    for (const [label, rep, file] of reports) {
      const errs = [...messages(rep.manifest && rep.manifest.errors), ...(rep.contents || []).flatMap((c) => messages(c.errors)), ...messages(rep.errors)]
      if (!rep.success || errs.length) {
        out.push(viol('K4', file, `${label}:${errs.join('|')}`, `claude plugin validate failed for the ${label}: ${errs.slice(0, 3).join(' / ') || 'no detail given'}.`, 'Run claude plugin validate on it and fix the errors it prints.'))
      }
    }
    const readme = tree.text(P.readme)
    const notes = (reports[0][1].contents || []).filter((c) => c.type === 'hooks').flatMap((c) => c.notes || [])
    if (!notes.length) {
      out.push(viol('K5', P.readme, 'unable:no-notes', 'Unable to verify: the validator reported no hooks summary to compare with the README.', 'Check the validator output, or the README quote cannot be verified.'))
    } else if (readme != null) {
      const flat = collapse(readme)
      for (const line of notes) {
        if (!flat.includes(collapse(line))) {
          out.push(viol('K5', P.readme, `quote:${line}`, `The README does not contain this line from the validator: ${line}`, 'Re-quote the validator output in the README (claude plugin validate ./claude-redline) so the disclosure matches the code.'))
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return out
}
