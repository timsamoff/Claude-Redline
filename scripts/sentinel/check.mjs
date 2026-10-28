#!/usr/bin/env node
// Sentinel gate checks. Run with no arguments for a diff check; see CLAUDE.md for every mode.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as git from './lib/git.mjs'
import { loadJson, format, applyExceptions, applyBaseline } from './lib/report.mjs'
import { checkMessage } from './lib/commit-message.mjs'
import { evaluateGates } from './lib/signals.mjs'
import { checkDefaults, checkBareNumbers, checkToasts, checkIds, checkIcon, checkReadme } from './lib/consistency.mjs'
import { validateTree } from './lib/validator.mjs'
import * as ext from './lib/extensions.mjs'
import { checkNotes } from './lib/notes.mjs'

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const valueOf = (f) => args[args.indexOf(f) + 1]
const err = (s = '') => process.stderr.write(s + '\n')

let root, dir, rules, exceptions, baseline

// Loaded inside the error handler, so a broken rules file reports plainly instead of as a stack trace.
function init() {
  root = git.repoRoot(process.cwd())
  dir = join(root, 'scripts', 'sentinel')
  const load = (name, fallback) => {
    try {
      return loadJson(join(dir, name), fallback)
    } catch (e) {
      throw new Error(`scripts/sentinel/${name} is not valid JSON (${e.message})`)
    }
  }
  rules = load('rules.json', null)
  if (!rules) throw new Error('scripts/sentinel/rules.json is missing')
  exceptions = load('sentinel-exceptions.json', { exceptions: [] })
  baseline = load('baseline.json', { entries: [] })
}

const under = (p, list) => list.some((w) => p === w || p.startsWith(w))

function stateChecks(tree) {
  return [...checkDefaults(tree, rules), ...checkBareNumbers(tree, rules), ...checkToasts(tree, rules), ...checkIds(tree, rules), ...checkIcon(tree, rules), ...checkReadme(tree, rules)]
}

function hygiene(changes) {
  const out = []
  for (const c of changes) {
    if (c.status === 'D') continue
    if (/\.tmp$/i.test(c.path)) out.push({ rule: 'K7', file: c.path, key: `tmp:${c.path}`, message: 'This looks like a temporary file (such as an Illustrator ~ai-*.tmp).', fix: 'Unstage it, and add its pattern to .gitignore if it keeps appearing.' })
    else if (git.isIgnored(root, c.path)) out.push({ rule: 'K7', file: c.path, key: `ignored:${c.path}`, message: 'This file matches .gitignore but is being committed.', fix: 'Unstage it, or remove the .gitignore rule if it should be tracked.' })
  }
  return out
}

function hooksIntact(tree) {
  const out = []
  const bad = (key, message, fix) => out.push({ rule: 'I1', file: '.githooks', key, message, fix })
  if (git.config(root, 'core.hooksPath') !== '.githooks') bad('hooksPath', 'core.hooksPath is not set to .githooks, so the hooks are not running in this clone.', 'Run: node scripts/sentinel/check.mjs --install')
  for (const h of ['commit-msg', 'pre-commit', 'pre-push']) {
    const p = `.githooks/${h}`
    if (!tree.has(p)) { bad(`missing:${h}`, `${p} is missing.`, 'Restore it from git history.'); continue }
    const m = (tree.kind === 'head' ? git.treeModes(root, 'HEAD', p) : git.indexModes(root, p))[0]
    if (m && m.mode !== '100755') bad(`mode:${h}`, `${p} is tracked without the executable bit (mode ${m.mode}).`, 'Run: node scripts/sentinel/check.mjs --install')
  }
  if (!tree.has('scripts/sentinel/check.mjs')) bad('check', 'scripts/sentinel/check.mjs is missing.', 'Restore it from git history.')
  return out
}

function fullChecks(tree, { pushHook = false } = {}) {
  const v = [...stateChecks(tree), ...validateTree(tree, rules), ...git.ignoredButTracked(root).map((p) => ({ rule: 'K7', file: p, key: `tracked-ignored:${p}`, message: 'This tracked file also matches .gitignore.', fix: 'Untrack it with git rm --cached, or remove the .gitignore rule.' }))]
  v.push(...hooksIntact(tree))
  return v
}

// Prints the outcome and returns the exit code: 0 pass, 1 blocked.
function finish(label, violations, { reminders = [], notices = [], quietPass = true } = {}) {
  const a = applyExceptions(violations, exceptions)
  const b = applyBaseline(a.remaining, baseline)
  if (b.fresh.length) {
    err(`SENTINEL: ${b.fresh.length} problem${b.fresh.length === 1 ? '' : 's'} block this ${label}.`)
    err()
    for (const v of b.fresh) err(format(v) + '\n')
  } else if (!quietPass) err(`SENTINEL: ${label} passed.`)
  if (b.baselined.length) err(`(${b.baselined.length} known problem${b.baselined.length === 1 ? '' : 's'} from the baseline did not block.)`)
  if (a.exempted) err(`(${a.exempted} problem${a.exempted === 1 ? '' : 's'} covered by an unexpired exception.)`)
  for (const r of reminders) err('Reminder: ' + r)
  for (const n of notices) err('Note: ' + n)
  return b.fresh.length ? 1 : 0
}

function commitChecks(after, changes, { record }) {
  const before = git.headTree(root)
  const v = [...evaluateGates({ before, after, changes, rules })]
  if (changes.some((c) => under(c.path, rules.watch))) v.push(...stateChecks(after))
  if (changes.some((c) => under(c.path, rules.validatorWatch))) v.push(...validateTree(after, rules))
  v.push(...hygiene(changes))
  v.push(...ext.check(root, changes, { record }))
  const reminders = changes.some((c) => rules.reminderWatch.includes(c.path)) ? ['If this finished a TODO item, move it to Done in Sentinel-Notes/TODO.md.'] : []
  return { v, reminders }
}

function main() {
  init()
  if (has('--hook')) {
    const name = valueOf('--hook')
    if (name === 'commit-msg') {
      const v = checkMessage(readFileSync(args[args.indexOf('--hook') + 2], 'utf8'), rules)
      return finish('commit message', v)
    }
    if (name === 'pre-commit') {
      const changes = git.stagedChanges(root)
      if (!changes.length) return 0
      const { v, reminders } = commitChecks(git.stagedTree(root), changes, { record: true })
      return finish('commit', v, { reminders })
    }
    if (name === 'pre-push') return finish('push', fullChecks(git.headTree(root)))
    throw new Error(`unknown hook "${name}"`)
  }
  if (has('--full')) {
    const tree = valueOf('--tree') === 'head' ? git.headTree(root) : git.worktreeTree(root)
    return finish('full scan', fullChecks(tree), { quietPass: false })
  }
  if (has('--notes')) {
    const { violations, notices } = checkNotes(root)
    return finish('notes check', violations, { notices, quietPass: false })
  }
  if (has('--last-message')) {
    err('Checking the most recent commit after the fact. A hook can stop a bad commit; this can only flag one that already landed.')
    return finish('last commit message', checkMessage(git.lastCommitMessage(root), rules), { quietPass: false })
  }
  if (has('--seed-extensions')) {
    const set = ext.seed(root, { worktree: has('--with-worktree') })
    err(`Recorded ${set.size} known extensions: ${[...set].sort().join(' ')}`)
    return 0
  }
  if (has('--write-baseline')) {
    const v = fullChecks(git.worktreeTree(root)).filter((x) => x.rule !== 'I1')
    writeFileSync(join(dir, 'baseline.json'), JSON.stringify({ entries: v.map((x) => ({ rule: x.rule, file: x.file, key: x.key })) }, null, 2) + '\n')
    err(`Wrote ${v.length} baseline entr${v.length === 1 ? 'y' : 'ies'}. Hook-wiring checks (I1) are never baselined.`)
    return 0
  }
  if (has('--install')) {
    git.run(['config', 'core.hooksPath', '.githooks'], { cwd: root })
    for (const h of ['commit-msg', 'pre-commit', 'pre-push']) {
      const p = `.githooks/${h}`
      if (git.indexModes(root, p).length) git.run(['update-index', '--chmod=+x', '--', p], { cwd: root })
      else err(`${p} is not committed yet. After committing, run this again to set its executable bit.`)
    }
    if (!ext.load(root)) ext.seed(root)
    err('core.hooksPath is now .githooks. Hooks: ' + git.indexModes(root, '.githooks').map((m) => `${m.path.split('/').pop()}=${m.mode}`).join(', '))
    return 0
  }
  const staged = git.stagedChanges(root)
  const useStaged = staged.length > 0
  const changes = useStaged ? staged : git.worktreeChanges(root)
  if (!changes.length) { err('SENTINEL: no changes to check.'); return 0 }
  const { v, reminders } = commitChecks(useStaged ? git.stagedTree(root) : git.worktreeTree(root), changes, { record: false })
  return finish(useStaged ? 'staged diff check' : 'working-tree diff check', v, { reminders, quietPass: false })
}

try {
  process.exitCode = main()
} catch (e) {
  err(`SENTINEL could not verify: ${e.message}`)
  err('A check that cannot run is not a pass, so this is blocked. Fix the problem above, then try again.')
  process.exitCode = 2
}
