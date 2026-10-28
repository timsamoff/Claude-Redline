// Integration tests: real git commits and pushes in a throwaway clone with the hooks installed.
// Run: node scripts/sentinel/tests/integration.mjs (takes about two minutes).
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.argv[2] || join(import.meta.dirname, '..', '..', '..'))
const WORK = join(tmpdir(), 'sentinel-it')
const repo = join(WORK, 'repo')
const remote = join(WORK, 'remote.git')
const q = (p) => '"' + p + '"'
const msgFile = join(tmpdir(), 'sentinel-it-msg.txt')

const results = []
const expect = (name, cond, detail = '') => results.push({ name, ok: Boolean(cond), detail: cond ? '' : detail })
const run = (cmd, args, opts = {}) => {
  const x = opts.shell
    ? spawnSync([cmd, ...args].join(' '), { cwd: opts.cwd || repo, encoding: 'utf8', env: { ...process.env, ...(opts.env || {}) }, shell: true })
    : spawnSync(cmd, args, { cwd: opts.cwd || repo, encoding: 'utf8', env: { ...process.env, ...(opts.env || {}) } })
  return { status: x.status, out: (x.stdout || '') + (x.stderr || '') }
}
const git = (args, opts) => run('git', args, opts)
const r = (p) => readFileSync(join(repo, p), 'utf8')
const w = (p, t) => { mkdirSync(join(repo, p, '..'), { recursive: true }); writeFileSync(join(repo, p), t) }
const sub = (p, from, to) => {
  const t = r(p)
  if (!t.includes(from)) throw new Error(`test setup: "${from}" not found in ${p}`)
  w(p, t.replace(from, to))
}

// ---- set up a clean clone with the infrastructure committed and installed ----
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
git(['clone', '--quiet', '-c', 'core.autocrlf=false', ROOT, repo], { cwd: WORK })
git(['config', 'user.name', 'Test'])
git(['config', 'user.email', 'test@example.com'])
git(['config', 'core.autocrlf', 'false'])
for (const p of ['.githooks', 'scripts', '.claude', '.gitattributes']) cpSync(join(ROOT, p), join(repo, p), { recursive: true })
git(['add', '-A'])
git(['commit', '--quiet', '--no-verify', '-m', 'Add sentinel infrastructure'])
const install = run('node', [join(repo, 'scripts/sentinel/check.mjs'), '--install'])
expect('install sets core.hooksPath', git(['config', 'core.hooksPath']).out.trim() === '.githooks', install.out)
git(['add', '-A'])
git(['commit', '--quiet', '--no-verify', '--allow-empty', '-m', 'Set hook executable bits'])
const BASE = git(['rev-parse', 'HEAD']).out.trim()
expect('the committed hook files carry the executable bit', git(['ls-tree', 'HEAD', '.githooks/pre-commit']).out.startsWith('100755'), git(['ls-tree', 'HEAD', '.githooks/pre-commit']).out)
const reset = () => { git(['reset', '--hard', '--quiet', BASE]); git(['clean', '-fdq']) }
const commit = (m = 'Test change') => git(['commit', '-m', m])
const msgCommit = (text) => { writeFileSync(msgFile, text); return git(['commit', '--allow-empty', '-F', msgFile]) }
const blocked = (name, x, ...ids) => expect(name, x.status !== 0 && ids.every((id) => x.out.includes(id)), `status ${x.status}; wanted ${ids.join(', ')}; got: ${x.out.slice(0, 400)}`)
const passes = (name, x) => expect(name, x.status === 0, `status ${x.status}: ${x.out.slice(0, 400)}`)

// ---- 1. the trivial sanity case: a blatantly bad message is rejected by a real commit ----
reset()
blocked('blatant: 200-char lowercase subject with prose is rejected', msgCommit('x'.repeat(200) + '\n\nthis is a long narrative paragraph that explains everything in sentences with no structure at all.'), '[M1]')
reset()

// ---- 2. commit messages ----
const history = run('git', ['log', '--format=%s'], { cwd: ROOT }).out.split('\n').filter(Boolean)
for (const s of history) { reset(); passes(`real past subject passes: ${s.slice(0, 50)}`, msgCommit(s)) }
reset()
passes('body of 3 bullets passes', msgCommit('Add three things\n\n- First thing\n- Second thing\n- Third thing: with a colon'))
reset()
blocked('5 bullets rejected', msgCommit('Add many things\n\n- one\n- two\n- three\n- four\n- five'), '[M2]', 'onsider splitting')
reset()
blocked('bullet over 80 chars rejected', msgCommit('Add a thing\n\n- ' + 'x'.repeat(90)), '[M2]')
reset()
blocked('prose paragraph under any cap rejected', msgCommit('Add a thing\n\nThis explains the change in a sentence.'), '[M2]')
reset()
blocked('several short unmarked lines (one block) rejected', msgCommit('Add a thing\n\nShort line one.\nShort line two.\nShort line three.'), '[M2]')
reset()
blocked('blank-line-separated paragraphs rejected', msgCommit('Add a thing\n\n- one\n\n- two'), '[M2]')
reset()
blocked('indented continuation line rejected', msgCommit('Add a thing\n\n- one that wraps\n  onto a second line'), '[M2]')
reset()
blocked('subject with body but no blank separator rejected', msgCommit('Add a thing\n- one'), '[M2]')
reset()
blocked('Signed-off-by trailer rejected', msgCommit('Add a thing\n\n- one\n\nSigned-off-by: Someone <a@b.c>'), '[M4]')
reset()
blocked('Sentinel-Override trailer rejected (no override exists)', msgCommit('Add a thing\n\n- one\n\nSentinel-Override: because'), '[M4]')
reset()
blocked('Co-Authored-By rejected', msgCommit('Add a thing\n\nCo-Authored-By: Claude <noreply@anthropic.com>'), '[M3]')
reset()
blocked('robot-emoji generated attribution rejected', msgCommit('Add a thing\n\n- one\n\n\u{1F916} Generated with [Claude Code](https://claude.com/claude-code)'), '[M3]')
reset()
blocked('Claude-Session trailer rejected', msgCommit('Add a thing\n\nClaude-Session: https://claude.ai/code/session_x'), '[M3]')
reset()
blocked('agent-voice phrase rejected', msgCommit('Add a thing at the user\'s direction'), '[M5]')
reset()
passes('project vocabulary (Claude Code) is allowed', msgCommit('Require Claude Code 2.1.299 for toasts'))
reset()
blocked('type prefix rejected', msgCommit('feat: add a thing'), '[M1]')
reset()
blocked('lowercase start rejected', msgCommit('add a thing'), '[M1]')
reset()
blocked('trailing period rejected', msgCommit('Add a thing.'), '[M1]')
reset()
blocked('73-char subject rejected', msgCommit('A' + 'b'.repeat(72)), '[M1]')
reset()
passes('72-char subject passes (the real maximum)', msgCommit('A' + 'b'.repeat(71)))
reset()
passes('git comment lines in the message file are ignored', msgCommit('Add a thing\n# Please enter the commit message\n# more help text'))
reset()

// ---- 3. documentation gates and consistency checks, as real commits ----
const REG = 'claude-redline/hooks/register.js'
const PJ = 'claude-redline/.claude-plugin/plugin.json'

sub(REG, "const HOUR_MS = 3600000\n", "const HOUR_MS = 3600000\nconst EXTRA = 5\n")
git(['add', REG])
blocked('G1: new constant without CLAUDE.md is blocked', commit(), '[G1]', 'named constants')
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: EXTRA is a new constant.\n')
git(['add', 'CLAUDE.md'])
passes('G1: same change with CLAUDE.md staged passes', commit())
reset()

sub(REG, 'const MIN_SECONDS = 1\n', '')
git(['add', REG])
blocked('G1 + K1: DELETING a constant is caught', commit(), '[G1]', 'Unable to verify')
reset()

sub(REG, "  on('session.measure'", "  on('turn.start', async ($, e, next) => next(e))\n  on('session.measure'")
git(['add', REG])
blocked('G3: a new hooked event requires DESIGN.md (and CLAUDE.md, README quote)', commit(), '[G3]', '[G1]', '[K5]')
reset()

sub(PJ, '"title": "Toast duration (seconds)"', '"title": "Toast time (seconds)"')
git(['add', PJ])
blocked('G2: changing a setting without README is blocked', commit(), '[G2]', '[G1]')
sub('README.md', 'Toast duration (seconds)', 'Toast time (seconds)')
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: renamed a setting.\n')
git(['add', 'README.md', 'CLAUDE.md'])
passes('G2: with README and CLAUDE.md staged it passes', commit())
reset()

sub(PJ, '"default": 6', '"default": 7')
w('README.md', r('README.md') + '\n')
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: default changed.\n')
git(['add', PJ, 'README.md', 'CLAUDE.md'])
const k1 = commit()
blocked('K1: plugin.json default differs from the constant', k1, '[K1]', 'DEFAULT_TOAST_SECONDS')
expect('K1: reported alone (docs were staged)', !k1.out.includes('[G'), k1.out.slice(0, 300))
reset()

sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
git(['add', REG])
blocked('K2: bare 120 outside the constants', commit(), '[K2]', 'MAX_SECONDS')
reset()

sub(REG, 'if (level >= ALERT_AT) longest = alertMs', 'if (level >= 95) longest = alertMs')
git(['add', REG])
blocked('K2 adversarial: bare 95 in the alert rule is still caught', commit(), '[K2]', 'ALERT_AT')
reset()

sub(REG, '$.ui.toast(failureText(err), { timeoutMs: alertMs })', "$.ui.toast('Write failed', { timeoutMs: alertMs })")
git(['add', REG])
blocked('K3: a hand-typed toast is blocked', commit(), '[K3]')
reset()

sub(REG, 'toastEach($, segments, longest)', "toastEach($, ['hand made'], longest)")
git(['add', REG])
blocked('K3: a toastEach call with hand-typed texts is blocked', commit(), '[K3]')
reset()

sub(PJ, '"title": "Toast duration (seconds)",', '"title": "Toast duration (seconds)",\n      "bogus": true,')
w('README.md', r('README.md') + '\n')
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: touched.\n')
git(['add', PJ, 'README.md', 'CLAUDE.md'])
blocked('K4: an invalid manifest fails the validator', commit(), '[K4]')
reset()

sub('README.md', '$.ui.log, ', '')
git(['add', 'README.md'])
blocked('K5: a stale validator quote in the README is blocked', commit(), '[K5]')
reset()

sub('.claude-plugin/marketplace.json', '"name": "redline"', '"name": "redlineX"')
git(['add', '.claude-plugin/marketplace.json'])
blocked('K6: marketplace entry name differs from the manifest', commit(), '[K6]')
reset()

w('scratch/x.md', 'ignored\n')
git(['add', '-f', 'scratch/x.md'])
blocked('K7: force-adding an ignored file is blocked', commit(), '[K7]')
reset()

w('prod/~ai-test.tmp', 'temp\n')
git(['add', '-f', 'prod/~ai-test.tmp'])
blocked('K7: a temporary file is blocked', commit(), '[K7]')
reset()

run('magick', ['-size', '300x300', 'xc:red', q(join(repo, 'claude-redline/.claude-plugin/icon.png'))], { shell: true })
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: icon.\n')
git(['add', 'claude-redline/.claude-plugin/icon.png', 'CLAUDE.md'])
blocked('K8: a 300 px icon is blocked', commit(), '[K8]', '512 to 2048')
reset()

cpSync(join(repo, 'assets/claude-redline-icon-512.png'), join(repo, 'claude-redline/.claude-plugin/icon.png'))
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: icon.\n')
git(['add', 'claude-redline/.claude-plugin/icon.png', 'CLAUDE.md'])
passes('K8: a valid 512 px PNG icon passes', commit())
reset()

cpSync(join(repo, 'prod/claude-redline-icon.svg'), join(repo, 'claude-redline/.claude-plugin/icon.svg'))
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: icon.\n')
git(['add', 'claude-redline/.claude-plugin/icon.svg', 'CLAUDE.md'])
blocked('K8: an SVG icon is blocked', commit(), '[K8]', 'SVG')
reset()

sub('README.md', 'MIT', 'BSD')
git(['add', 'README.md'])
blocked('R1: removing a required README phrase is blocked', commit(), '[R1]', 'MIT')
reset()

w('README.md', r('README.md').split('95 percent').join('ninety-five').split('95%').join('ninety-five'))
git(['add', 'README.md'])
blocked('R1: dropping a toast level from the README is blocked', commit(), '[R1]', '95')
reset()

// ---- 4. staged content, not the working tree ----
sub(REG, "const HOUR_MS = 3600000\n", "const HOUR_MS = 3600000\nconst STAGED_ONE = 5\n")
w('CLAUDE.md', r('CLAUDE.md') + '\nNote: STAGED_ONE.\n')
git(['add', REG, 'CLAUDE.md'])
sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
const stagedOk = commit()
passes('staged compliant + unstaged violation: the hook judges what is staged', stagedOk)
expect('the committed register.js is the staged one', !git(['show', 'HEAD:' + REG]).out.includes('Math.max(n, 1), 120'))
reset()

sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
git(['add', REG])
w(REG, git(['show', 'HEAD:' + REG]).out)
blocked('staged violation + clean working tree: still blocked', commit(), '[K2]')
reset()

// ---- 5. a very large change is still fully checked ----
const big = r(REG).split('\n')
const filler = Array.from({ length: 5000 }, (_, i) => `const filler${i} = ${i}`)
big.splice(60, 0, ...filler, 'const hidden = 120')
w(REG, big.join('\n'))
git(['add', REG])
blocked('large diff: a violation at line ~5000 is still found', commit(), '[K2]', 'MAX_SECONDS')
reset()

// ---- 6. the check failing must block, never pass ----
w(PJ, '{ not json')
git(['add', PJ])
blocked('invalid plugin.json: blocks, and names the file', commit(), 'could not verify', 'plugin.json')
reset()

w('scripts/sentinel/rules.json', '{ broken')
w('README.md', r('README.md') + '\n')
git(['add', 'README.md'])
const brokenRules = commit()
blocked('invalid rules.json: blocks with a plain message naming the file', brokenRules, 'could not verify', 'rules.json')
expect('invalid rules.json: no raw stack trace is shown', !brokenRules.out.includes('at JSON.parse'), brokenRules.out.slice(0, 300))
reset()

w('README.md', r('README.md') + '\n')
git(['add', 'README.md'])
const noClaude = git(['commit', '-m', 'Test change'], { env: { PATH: 'C:\\Program Files\\Git\\cmd;C:\\Windows\\System32', USERPROFILE: tmpdir(), APPDATA: '', CLAUDE_BIN: '' } })
blocked('claude command unavailable: blocks with a plain message', noClaude, 'claude command was not found')
reset()

const noNode = git(['commit', '--allow-empty', '-m', 'bad lowercase subject'], { env: { PATH: 'C:\\Program Files\\Git\\cmd;C:\\Windows\\System32' } })
blocked('node not on PATH: the shim finds the standard install path and the check still runs', noNode, '[M1]')
reset()

// ---- 7. exceptions ----
const EXC = 'scripts/sentinel/sentinel-exceptions.json'
const exc = (reviewBy, over = {}) => w(EXC, JSON.stringify({ exceptions: [{ rule: 'K2', file: REG, match: 'Math.max(n, 1), 120', reason: 'test', owner: 'Tim', reviewBy, ...over }] }, null, 2))
sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
git(['add', REG])
exc('2999-01-01')
const exOk = commit()
passes('an unexpired, narrow exception exempts exactly that violation', exOk)
expect('and says so in the output', exOk.out.includes('unexpired exception'), exOk.out.slice(0, 300))
reset()

sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
git(['add', REG])
exc('2020-01-01')
blocked('an EXPIRED exception does not exempt, and is itself reported', commit(), '[K2]', '[X1]')
reset()

sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
sub(REG, "const HOUR_MS = 3600000\n", "const HOUR_MS = 3600000\n\n\n\n\n\n\n\n\n\n")
exc('2999-01-01')
git(['add', REG])
passes('exception is keyed to content: shifting the line by 10 does not break it', commit())
reset()

sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 2), 120)')
exc('2999-01-01')
git(['add', REG])
blocked('exception is keyed to content: changing the line voids it', commit(), '[K2]')
reset()

sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
exc('2999-01-01', { file: '*.js' })
git(['add', REG])
blocked('a wildcard file scope is rejected', commit(), '[X2]', '[K2]')
reset()

// ---- 8. new kind of file blocks once ----
run('magick', ['-size', '8x8', 'xc:blue', q(join(repo, 'prod/new-thing.bmp'))], { shell: true })
git(['add', 'prod/new-thing.bmp'])
const n1 = commit()
blocked('N1: the first .bmp blocks and asks the three questions', n1, '[N1]', 'What kind of file')
const n2 = commit()
passes('N1: the retry passes (the type is now recorded)', n2)
run('magick', ['-size', '8x8', 'xc:green', q(join(repo, 'prod/second.bmp'))], { shell: true })
git(['add', 'prod/second.bmp'])
passes('N1: a second .bmp passes silently', commit())
expect('N1: the manifest now lists .bmp', readFileSync(join(repo, '.git/sentinel/known-extensions.txt'), 'utf8').includes('.bmp'))
reset()
passes('known extensions (.png) never trigger N1', (() => { run('magick', ['-size', '8x8', 'xc:red', q(join(repo, 'prod/another.png'))], { shell: true }); git(['add', 'prod/another.png']); return commit() })())
reset()

// ---- 9. push gate, baseline, hook wiring ----
rmSync(remote, { recursive: true, force: true })
git(['init', '--bare', '--quiet', '-b', 'main', remote])
git(['remote', 'remove', 'origin'])
git(['remote', 'add', 'origin', remote])
const pushClean = git(['push', 'origin', 'main'])
passes('pre-push: a clean tree pushes', pushClean)

sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
git(['add', REG])
git(['commit', '--no-verify', '-m', 'Bypass the commit hook'])
const pushBad = git(['push', 'origin', 'main'])
blocked('pre-push: a violation that bypassed the commit hook is caught and the push FAILS', pushBad, '[K2]')
expect('the remote did not receive the bad commit', !git(['ls-remote', 'origin', 'refs/heads/main']).out.includes(git(['rev-parse', 'HEAD']).out.trim()))

const wb = run('node', [join(repo, 'scripts/sentinel/check.mjs'), '--write-baseline'])
expect('--write-baseline records the existing violation', JSON.parse(r('scripts/sentinel/baseline.json')).entries.some((e) => e.rule === 'K2'), wb.out)
passes('baseline: the baselined violation no longer blocks the push', git(['push', 'origin', 'main']))

sub(REG, 'Math.min(Math.max(n, 1), 120)', 'Math.min(Math.max(n, 1), 120) + 90 - 90')
git(['add', REG])
git(['commit', '--no-verify', '-m', 'Add a second violation'])
blocked('baseline: a NEW violation still blocks the push', git(['push', 'origin', 'main']), '[K2]')
reset()

git(['config', '--unset', 'core.hooksPath'])
const unwired = run('node', [join(repo, 'scripts/sentinel/check.mjs'), '--full'])
blocked('full scan: a clone without core.hooksPath fails the wiring check', unwired, '[I1]', 'core.hooksPath')
run('node', [join(repo, 'scripts/sentinel/check.mjs'), '--install'])

git(['update-index', '--chmod=-x', '.githooks/pre-push'])
const noExec = run('node', [join(repo, 'scripts/sentinel/check.mjs'), '--full'])
blocked('full scan: a hook without the executable bit fails the wiring check', noExec, '[I1]', 'executable')
reset()

// ---- 11. README structure (the problems that slipped past the first checks) ----
w('README.md', '```markdown\n' + r('README.md') + '\n```\n')
git(['add', 'README.md'])
blocked('R2: a README wrapped in one code fence is blocked', commit(), '[R2]', 'one code block')
reset()
sub('README.md', '(claude-redline/hooks/register.js)', '(claude-redline/register.js)')
git(['add', 'README.md'])
blocked('R2: a broken relative link is blocked', commit(), '[R2]', 'does not exist')
reset()
sub('README.md', '(LICENSE)', '(license)')
git(['add', 'README.md'])
blocked('R2: a link with the wrong letter case is blocked (GitHub is case-sensitive)', commit(), '[R2]')
reset()
w('README.md', r('README.md') + '\n```text\n[a broken link](nowhere/at/all.md)\n```\n')
git(['add', 'README.md'])
passes('R2: a broken-looking link inside a code block is not a false positive', commit())
reset()
w('README.md', r('README.md') + '\n```text\nunclosed\n')
git(['add', 'README.md'])
blocked('R2: an unclosed code fence is blocked', commit(), '[R2]', 'odd number')
reset()
sub('README.md', '<img src="assets/claude-redline-icon-512.png" alt="Claude-Redline icon" width="128px">', '')
git(['add', 'README.md'])
blocked('R1: losing the icon line is blocked', commit(), '[R1]', 'claude-redline-icon-512.png')
reset()
w('DESIGN.md', r('DESIGN.md') + '\nSee [the guide](docs/guide.md).\n')
git(['add', 'DESIGN.md'])
blocked('R2: a broken link in DESIGN.md is blocked too', commit(), '[R2]', 'DESIGN.md')
reset()
// ---- 12. the TODO and brief sync check (a manual command, because the notes are git-ignored) ----
const notes = (todo, files = {}) => {
  rmSync(join(repo, 'Sentinel-Notes'), { recursive: true, force: true })
  w('Sentinel-Notes/TODO.md', todo)
  for (const [name, text] of Object.entries(files)) w('Sentinel-Notes/' + name, text)
  return run('node', [join(repo, 'scripts/sentinel/check.mjs'), '--notes'])
}
const HEAD = '# TODO\n\n## Open\n\n'
passes('notes: a linked open brief passes', notes(HEAD + '- [ ] [A1] Do a thing (see `a-design-brief.md`).\n\n## Done\n\n', { 'a-design-brief.md': 'x' }))
passes('notes: a Done item may mention a brief that an open item still uses', notes(HEAD + '- [ ] [A1] Do a thing (see `a-design-brief.md`).\n\n## Done\n\n- [x] [A2] Did part of it (`a-design-brief.md`).\n', { 'a-design-brief.md': 'x' }))
blocked('notes T1: a brief no item mentions is flagged', notes(HEAD + '- [ ] [A1] Do a thing.\n\n## Done\n\n', { 'orphan-design-brief.md': 'x' }), '[T1]')
blocked('notes T2: an item naming a missing brief is flagged', notes(HEAD + '- [ ] [A1] Do a thing (see `ghost-design-brief.md`).\n'), '[T2]')
blocked('notes T3: a finished item whose brief is not archived is flagged', notes(HEAD + '## Done\n\n- [x] [A1] Did it (`a-design-brief.md`).\n', { 'a-design-brief.md': 'x' }), '[T3]')
passes('notes: a finished item with its brief archived passes', notes(HEAD + '## Done\n\n- [x] [A1] Did it (`a-design-brief.md`).\n', { 'archive/a-design-brief.md': 'x' }))
blocked('notes T4: an open item whose brief was archived is flagged', notes(HEAD + '- [ ] [A1] Do a thing (`a-design-brief.md`).\n', { 'archive/a-design-brief.md': 'x' }), '[T4]')
blocked('notes T5: an item that continues onto a second line is flagged', notes(HEAD + '- [ ] [A1] Do a thing\n  and keep going on another line.\n'), '[T5]')
blocked('notes T5: an item with no tag is flagged', notes(HEAD + '- [ ] Do a thing with no tag.\n'), '[T5]')
rmSync(join(repo, 'Sentinel-Notes'), { recursive: true, force: true })
const noNotes = run('node', [join(repo, 'scripts/sentinel/check.mjs'), '--notes'])
expect('notes: a clone with no Sentinel-Notes skips with a plain note, not a failure', noNotes.status === 0 && noNotes.out.includes('local-only'), noNotes.out)
// ---- 10. partial commits and amends ----
sub(REG, 'Math.min(Math.max(n, MIN_SECONDS), MAX_SECONDS)', 'Math.min(Math.max(n, 1), 120)')
git(['add', REG])
w('README.md', r('README.md') + '\n')
passes('partial commit (git commit <path>): only the named file is judged', git(['commit', 'README.md', '-m', 'Test change']))
expect('the staged violation in the other file was not committed', !git(['show', 'HEAD', '--stat']).out.includes('register.js'), git(['show', 'HEAD', '--stat']).out)
reset()
git(['commit', '--allow-empty', '-m', 'Fine subject'])
blocked('amend with a bad message is rejected', git(['commit', '--amend', '--allow-empty', '-m', 'bad lowercase.']), '[M1]')
reset()
// ---- report ----
const failed = results.filter((x) => !x.ok)
console.log(`\n${results.length - failed.length} of ${results.length} scenarios behaved as expected.\n`)
for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.ok ? '' : '\n        ' + String(x.detail).replace(/\n/g, '\n        ')}`)
process.exitCode = failed.length ? 1 : 0
