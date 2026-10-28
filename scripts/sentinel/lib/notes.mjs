// Checks Sentinel-Notes/TODO.md and its briefs by reading files on disk, because the notes are git-ignored and no commit hook can see them.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const viol = (rule, file, line, key, message, fix) => ({ rule, file, line, key, message, fix })
const BRIEF = /[\w.-]+-design-brief\.md/g

export function checkNotes(root) {
  const dir = join(root, 'Sentinel-Notes')
  const todo = join(dir, 'TODO.md')
  if (!existsSync(todo)) return { violations: [], notices: ['Sentinel-Notes/TODO.md is not on this machine (the notes are local-only), so the notes check was skipped.'] }
  const f = 'Sentinel-Notes/TODO.md'
  const out = []
  const notices = []
  const lines = readFileSync(todo, 'utf8').replace(/\r\n/g, '\n').split('\n')
  const items = []
  let prevWasItem = false
  lines.forEach((l, i) => {
    const m = l.match(/^- \[( |x)\] (.*)$/)
    if (m) {
      items.push({ n: i + 1, done: m[1] === 'x', text: m[2] })
      if (!/^\[[A-Z]\d*[a-z]?\] \S/.test(m[2])) out.push(viol('T5', f, i + 1, `tag:${m[2].slice(0, 30)}`, 'This item has no tag like [F4] at the start.', 'Start the item with a tag in brackets.'))
      prevWasItem = true
      return
    }
    if (prevWasItem && /^\s+\S/.test(l)) out.push(viol('T5', f, i + 1, `continuation:${l.trim().slice(0, 30)}`, 'An item continues onto a second line. Items are one line.', 'Keep the item to one line and move the detail to a design brief.'))
    prevWasItem = false
  })

  const archive = join(dir, 'archive')
  const exists = (name) => existsSync(join(dir, name)) || existsSync(join(archive, name))
  const referenced = new Set()
  const stillOpen = new Set(items.filter((it) => !it.done).flatMap((it) => it.text.match(BRIEF) || []))
  for (const it of items) {
    for (const name of it.text.match(BRIEF) || []) {
      referenced.add(name)
      if (!exists(name)) out.push(viol('T2', f, it.n, `missing:${name}`, `This item mentions ${name}, which does not exist.`, 'Fix the name or restore the file.'))
      else if (it.done && existsSync(join(dir, name)) && !stillOpen.has(name)) out.push(viol('T3', f, it.n, `done-not-archived:${name}`, `This item is done and no open item uses ${name}, but it is not in archive/.`, 'Move the brief to Sentinel-Notes/archive/.'))
      else if (!it.done && !existsSync(join(dir, name))) out.push(viol('T4', f, it.n, `open-but-archived:${name}`, `This item is open, but ${name} is in archive/.`, 'Move the brief back, or mark the item done.'))
    }
  }
  const briefFiles = readdirSync(dir).filter((n) => /^[\w.-]+-design-brief\.md$/.test(n))
  for (const name of briefFiles) {
    if (!referenced.has(name)) out.push(viol('T1', `Sentinel-Notes/${name}`, undefined, `unlinked:${name}`, `${name} is not mentioned by any item in TODO.md.`, 'Add or restore the TODO item that points to it, or archive the brief.'))
  }
  const todoTime = statSync(todo).mtimeMs
  for (const name of briefFiles) {
    if (statSync(join(dir, name)).mtimeMs > todoTime + 60000) notices.push(`${name} was edited after TODO.md. If that finished or changed an item, update TODO.md.`)
  }
  return { violations: out, notices }
}
