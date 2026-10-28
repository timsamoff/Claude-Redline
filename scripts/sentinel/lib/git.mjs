// Git views for the checks: the staged index, HEAD, and the working tree.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function run(args, { cwd, allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, maxBuffer: 512 * 1024 * 1024 })
  if (r.error) throw new Error(`could not run git: ${r.error.message}`)
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args.join(' ')} failed: ${String(r.stderr).trim()}`)
  return r
}

const split0 = (buf) => buf.toString('utf8').split('\0').filter(Boolean)

export function repoRoot(cwd) {
  return run(['rev-parse', '--show-toplevel'], { cwd }).stdout.toString('utf8').trim()
}

export function gitDir(root) {
  return run(['rev-parse', '--absolute-git-dir'], { cwd: root }).stdout.toString('utf8').trim()
}

export function hasHead(root) {
  return run(['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, allowFail: true }).status === 0
}

export function config(root, key) {
  const r = run(['config', '--get', key], { cwd: root, allowFail: true })
  return r.status === 0 ? r.stdout.toString('utf8').trim() : ''
}

function makeTree(kind, root, paths, read) {
  const set = new Set(paths)
  const buffer = (p) => (set.has(p) ? read(p) : null)
  const text = (p) => {
    const b = buffer(p)
    return b == null ? null : b.toString('utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
  }
  return { kind, root, list: () => paths, has: (p) => set.has(p), buffer, text }
}

export function stagedTree(root) {
  const paths = split0(run(['ls-files', '-z'], { cwd: root }).stdout)
  return makeTree('staged', root, paths, (p) => run(['show', ':' + p], { cwd: root }).stdout)
}

export function headTree(root) {
  if (!hasHead(root)) return makeTree('head', root, [], () => null)
  const paths = split0(run(['ls-tree', '-r', '-z', '--name-only', 'HEAD'], { cwd: root }).stdout)
  return makeTree('head', root, paths, (p) => run(['show', 'HEAD:' + p], { cwd: root }).stdout)
}

export function worktreeTree(root) {
  const all = split0(run(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root }).stdout)
  const paths = all.filter((p) => existsSync(join(root, p)))
  return makeTree('worktree', root, paths, (p) => readFileSync(join(root, p)))
}

function nameStatus(buf) {
  const t = split0(buf)
  const out = []
  for (let i = 0; i + 1 < t.length; i += 2) out.push({ status: t[i][0], path: t[i + 1] })
  return out
}

export function stagedChanges(root) {
  return nameStatus(run(['diff', '--cached', '--name-status', '-z', '--no-renames'], { cwd: root }).stdout)
}

export function worktreeChanges(root) {
  const tracked = hasHead(root)
    ? nameStatus(run(['diff', 'HEAD', '--name-status', '-z', '--no-renames'], { cwd: root }).stdout)
    : []
  const untracked = split0(run(['ls-files', '-z', '--others', '--exclude-standard'], { cwd: root }).stdout)
  return [...tracked, ...untracked.map((path) => ({ status: 'A', path }))]
}

export function lastCommitMessage(root) {
  return run(['log', '-1', '--format=%B'], { cwd: root }).stdout.toString('utf8')
}

export function ignoredButTracked(root) {
  return split0(run(['ls-files', '-ci', '--exclude-standard', '-z'], { cwd: root }).stdout)
}

export function isIgnored(root, path) {
  return run(['check-ignore', '--no-index', '-q', '--', path], { cwd: root, allowFail: true }).status === 0
}

export function treeModes(root, rev, prefix) {
  const out = run(['ls-tree', rev, '--', prefix], { cwd: root, allowFail: true }).stdout.toString('utf8')
  return out.split('\n').filter(Boolean).map((l) => ({ mode: l.split(/\s+/)[0], path: l.split('\t')[1] }))
}

export function indexModes(root, prefix) {
  const out = run(['ls-files', '-s', '--', prefix], { cwd: root }).stdout.toString('utf8')
  return out.split('\n').filter(Boolean).map((l) => ({ mode: l.split(/\s+/)[0], path: l.split('\t')[1] }))
}
