// Tracks which file extensions the project has contained, and blocks once on the first appearance of a new one.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gitDir, run } from './git.mjs'

export function extOf(path) {
  const base = path.split('/').pop()
  if (/^\.[^.]+$/.test(base)) return base.toLowerCase()
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i).toLowerCase() : '(none)'
}

const manifest = (root) => join(gitDir(root), 'sentinel', 'known-extensions.txt')

export function load(root) {
  const f = manifest(root)
  return existsSync(f) ? new Set(readFileSync(f, 'utf8').split('\n').filter(Boolean)) : null
}

function save(root, set) {
  mkdirSync(dirname(manifest(root)), { recursive: true })
  writeFileSync(manifest(root), [...set].sort().join('\n') + '\n')
}

const split0 = (buf) => buf.toString('utf8').split('\0').filter(Boolean)

// Seeds from every path in history and HEAD, plus the working tree when asked, so existing files never look new.
export function seed(root, { worktree = false } = {}) {
  const paths = [
    ...split0(run(['log', '--all', '--name-only', '--format=', '-z'], { cwd: root, allowFail: true }).stdout),
    ...split0(run(['ls-tree', '-r', '-z', '--name-only', 'HEAD'], { cwd: root, allowFail: true }).stdout),
  ]
  if (worktree) paths.push(...split0(run(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root }).stdout))
  const set = new Set(paths.map(extOf))
  save(root, set)
  return set
}

const QUESTIONS =
  'Answer three questions: (1) What kind of file is this, in plain terms? ' +
  '(2) Does it need a design-quality review (prompt 01, Part 7, for art, models, audio, voice or video)? ' +
  '(3) Does this kind of file need an integration step (prompt 02)? ' +
  'If 2 or 3 apply, add a one-line item to Sentinel-Notes/TODO.md. If it is a one-off, just commit again.'

export function check(root, changes, { record = true } = {}) {
  let known = load(root)
  if (!known) known = seed(root)
  const fresh = []
  for (const c of changes) {
    if (c.status !== 'A') continue
    const e = extOf(c.path)
    if (!known.has(e) && !fresh.some((f) => f.ext === e)) fresh.push({ ext: e, path: c.path })
  }
  if (!fresh.length) return []
  if (record) {
    for (const f of fresh) known.add(f.ext)
    save(root, known)
  }
  return fresh.map((f) => ({
    rule: 'N1',
    file: f.path,
    line: undefined,
    key: `new-extension:${f.ext}`,
    message: `${f.path} is the first "${f.ext}" file this project has ever had.${record ? ' This commit is blocked once so the questions get answered. The type is now recorded, so a retry passes.' : ''}`,
    fix: QUESTIONS,
  }))
}
