// Checks a commit message against the project's commit rules. Pure function with no git access.

const TRAILER = /^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+:\s*\S/
const TYPE_PREFIX = /^(feat|fix|chore|docs|refactor|test|tests|style|perf|build|ci|revert)(\([^)]*\))?!?:\s/i
const SPLIT = 'Does this commit bundle several separate things? Consider splitting it into separate commits.'

export function checkMessage(raw, rules) {
  const c = rules.commit
  const out = []
  const add = (rule, line, message, fix) =>
    out.push({ rule, file: 'commit message', line, key: `${rule}:${message}`, message, fix })

  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter((l) => !l.startsWith('#'))
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  if (!lines.length || !lines[0].trim()) {
    add('M1', 1, 'The commit message has no subject line.', 'Write a one-line subject.')
    return out
  }
  const subject = lines[0]
  if (/^Merge /.test(subject)) return out

  if (subject.length > c.subjectMax) add('M1', 1, `The subject is ${subject.length} characters. The limit is ${c.subjectMax}.`, 'Shorten the subject to one line within the limit.')
  if (subject !== subject.trim()) add('M1', 1, 'The subject has leading or trailing spaces.', 'Remove them.')
  if (!/^[A-Z]/.test(subject)) add('M1', 1, 'The subject must start with a capital letter.', 'Start the subject with a capital letter.')
  if (/\.$/.test(subject)) add('M1', 1, 'The subject ends with a period.', 'Remove the final period.')
  if (TYPE_PREFIX.test(subject)) add('M1', 1, 'This project does not use type prefixes such as feat: or fix:.', 'Write a plain sentence-case subject.')

  if (lines.length > 1) {
    if (lines[1].trim() !== '') {
      add('M2', 2, 'The subject must be a single line, and any body must start after a blank line.', 'Put a blank line after the subject, or shorten the message to one line. ' + SPLIT)
    }
    const body = lines.slice(2)
    let bullets = 0
    body.forEach((line, i) => {
      const n = i + 3
      if (TRAILER.test(line)) return
      if (line.trim() === '') {
        add('M2', n, 'There is a blank line inside the body. A body is one unbroken list of bullets.', SPLIT)
      } else if (/^\s/.test(line)) {
        add('M2', n, 'Indented or wrapped lines are not allowed. Each bullet is one line.', 'Shorten the bullet to one line, or split the commit.')
      } else if (!/^- \S/.test(line)) {
        add('M2', n, 'Every body line must start with "- ". Prose paragraphs are not allowed.', 'Rewrite it as short bullets, or drop the body. ' + SPLIT)
      } else {
        bullets += 1
        if (line.length > c.bulletMax) add('M2', n, `This bullet is ${line.length} characters. The limit is ${c.bulletMax}.`, 'Shorten it to one line within the limit.')
      }
    })
    if (bullets > c.bulletsMax) add('M2', 3, `The body has ${bullets} bullets. The limit is ${c.bulletsMax}.`, SPLIT + ' If it is one coherent change, use fewer, broader bullets.')
  }

  const allowed = new Set((c.allowedTrailers || []).map((t) => t.toLowerCase()))
  lines.forEach((line, i) => {
    if (!TRAILER.test(line)) return
    const name = line.slice(0, line.indexOf(':')).toLowerCase()
    if (!allowed.has(name)) add('M4', i + 1, `"${line.slice(0, line.indexOf(':') + 1)}" looks like a trailer, and no trailers are allowed.`, 'Remove the line.')
  })

  const patterns = c.attributionPatterns.map((p) => new RegExp(p, 'imu'))
  lines.forEach((line, i) => {
    if (patterns.some((re) => re.test(line))) add('M3', i + 1, 'This line looks like a generated attribution or co-author note.', 'Remove it. Commits are written as the author\'s own.')
  })

  const phrases = c.agentVoicePhrases.map((p) => p.toLowerCase())
  lines.forEach((line, i) => {
    const hit = phrases.find((p) => line.toLowerCase().includes(p))
    if (hit) add('M5', i + 1, `The phrase "${hit}" describes how the work was done, not the change.`, 'Describe only the change. This check is a phrase list and will miss other wordings, so the rule also lives in CLAUDE.md.')
  })
  return out
}
