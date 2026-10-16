// Proof test for the skills-root resolution in cordis.patch.yml.
//
// The bundle must NOT bake a machine-specific path into its config: the value is
// a `!!js` expression the loader evaluates when the row's fiber loads, so the
// same published file works on any host. This test evaluates that expression the
// way the loader does and checks the resolution order.
//
// Run:  node tests/patch-resolution.test.mjs [path/to/cordis.patch.yml]
//
// A hand-rolled extractor keeps this runnable with no dependencies; it asserts
// the shape hard, so a silent reformat fails the test instead of passing it.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const patchPath = process.argv[2] ?? join(here, '..', 'cordis.patch.yml')

let failures = 0
const pass = (m) => console.log(`  [PASS] ${m}`)
const fail = (m) => { console.log(`  [FAIL] ${m}`); failures += 1 }

// The loader's own evaluator (vendor/loader/src/config/utils.ts).
const evaluate = new Function('ctx', 'expr', 'with (ctx) { return eval(expr) }')

// Evaluate with a controlled environment, restoring the ambient one afterwards,
// so one assertion cannot leak its environment into the next.
function evalWith(overrides) {
  const saved = new Map()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return evaluate({}, expr)
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function extractJsExpr(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.includes('- !!js'))
  if (start === -1) {
    throw new Error('customSkillDirs carries a literal, not a `!!js` expression: ' +
      'the bundle would pin one machine\'s path')
  }
  const indent = lines[start].search(/\S/)
  const body = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '') break
    if (line.search(/\S/) <= indent) break
    body.push(line.trim())
  }
  if (body.length === 0) throw new Error('`!!js` expression has no body')
  return body.join(' ')
}

let expr
try {
  expr = extractJsExpr(readFileSync(patchPath, 'utf8'))
  pass(`skills root is a resolved expression (${patchPath.split('/').pop()})`)
} catch (err) {
  fail(err.message)
  console.log(`\n1 test(s) failed`)
  process.exit(1)
}

// 1. an explicit override wins
const overridden = evalWith({
  DSH_SUPERPOWERS_SKILLS_DIR: '/tmp/override/skills',
  DSH_HOME: undefined,
})
overridden === '/tmp/override/skills'
  ? pass('DSH_SUPERPOWERS_SKILLS_DIR overrides the default')
  : fail(`override ignored, got: ${overridden}`)

// 2. the default follows $DSH_HOME
const fromDshHome = evalWith({
  DSH_SUPERPOWERS_SKILLS_DIR: undefined,
  DSH_HOME: '/tmp/harness-home',
})
fromDshHome === '/tmp/harness-home/superpowers/skills'
  ? pass('default is $DSH_HOME/superpowers/skills')
  : fail(`expected /tmp/harness-home/superpowers/skills, got: ${fromDshHome}`)

// 3. and falls back to ~/.dsh when DSH_HOME is unset
const fromHome = evalWith({
  DSH_SUPERPOWERS_SKILLS_DIR: undefined,
  DSH_HOME: undefined,
  HOME: '/tmp/some-user',
})
fromHome === '/tmp/some-user/.dsh/superpowers/skills'
  ? pass('falls back to ~/.dsh/superpowers/skills')
  : fail(`expected /tmp/some-user/.dsh/superpowers/skills, got: ${fromHome}`)

// 4. the bundle must not pin any one machine's home directory
const pinned = /\/home\/|\/Users\//.test(readFileSync(patchPath, 'utf8'))
pinned
  ? fail('the patch still contains a machine-specific absolute path')
  : pass('no machine-specific path in the patch')

// 5. resolve with the AMBIENT environment: this is the check that matters on a
// configured host, and it is a no-op only when nothing is installed yet.
const real = evalWith({})
if (existsSync(real)) {
  const dirs = readdirSync(real, { withFileTypes: true }).filter((e) => e.isDirectory())
  const withSkill = dirs.filter((e) => existsSync(join(real, e.name, 'SKILL.md')))
  withSkill.length === dirs.length && dirs.length > 0
    ? pass(`resolved root on this host holds ${withSkill.length} skills (${real})`)
    : fail(`resolved root ${real} has ${dirs.length - withSkill.length} dir(s) without SKILL.md`)
} else {
  pass(`resolved root is not present on this host (${real}) - set DSH_SUPERPOWERS_SKILLS_DIR`)
}

console.log('')
if (failures > 0) {
  console.log(`${failures} test(s) failed`)
  process.exit(1)
}
console.log('All tests passed')
