// Formats violations and applies the exceptions file and the baseline.
import { existsSync, readFileSync } from 'node:fs'

export function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function format(v) {
  const where = v.file ? v.file + (v.line ? ':' + v.line : '') : ''
  return `[${v.rule}] ${where}\n    ${v.message}\n    Fix: ${v.fix}`
}

const EXC_FILE = 'scripts/sentinel/sentinel-exceptions.json'
const REQUIRED = ['rule', 'file', 'match', 'reason', 'owner', 'reviewBy']

// An expired or incomplete exception does not apply, exactly as if it did not exist.
export function applyExceptions(violations, config, today = new Date().toISOString().slice(0, 10)) {
  const extra = []
  const live = []
  for (const [i, e] of (config.exceptions || []).entries()) {
    const missing = REQUIRED.filter((k) => typeof e[k] !== 'string' || !e[k].trim())
    if (missing.length) {
      extra.push({ rule: 'X2', file: EXC_FILE, key: `entry ${i}`, message: `Exception entry ${i + 1} is missing: ${missing.join(', ')}.`, fix: 'Fill in every field, or remove the entry.' })
    } else if (/[*?]/.test(e.file)) {
      extra.push({ rule: 'X2', file: EXC_FILE, key: `entry ${i}`, message: `Exception entry ${i + 1} uses a wildcard file scope, which is not allowed.`, fix: 'Name one exact file.' })
    } else if (e.reviewBy < today) {
      extra.push({ rule: 'X1', file: EXC_FILE, key: `entry ${i}`, message: `The exception for ${e.rule} in ${e.file} expired on ${e.reviewBy}, so it no longer applies.`, fix: 'Fix the underlying problem, or renew the entry with a new review-by date and the owner\'s sign-off.' })
    } else {
      live.push(e)
    }
  }
  const remaining = violations.filter(
    (v) => !live.some((e) => e.rule === v.rule && e.file === v.file && String(v.key || '').includes(e.match)),
  )
  return { remaining: [...remaining, ...extra], exempted: violations.length - remaining.length }
}

export function applyBaseline(violations, baseline) {
  const known = new Set((baseline.entries || []).map((e) => `${e.rule}|${e.file}|${e.key}`))
  const fresh = []
  const baselined = []
  for (const v of violations) (known.has(`${v.rule}|${v.file}|${v.key}`) ? baselined : fresh).push(v)
  return { fresh, baselined }
}
