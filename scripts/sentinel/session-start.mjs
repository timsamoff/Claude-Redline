// Session-start hook: prints HANDOFF.md with an instruction to mention it, or prints nothing when the file is absent.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const file = join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), 'HANDOFF.md')
const text = existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
if (text) {
  console.log(
    'A handoff from a previous session follows. In your first reply, whatever the user asks, start with one line saying a handoff exists and what it covers, then answer their question. ' +
      "If version control shows uncommitted changes the handoff doesn't mention, say in that same line that it may be out of date.\n",
  )
  console.log(text)
}
