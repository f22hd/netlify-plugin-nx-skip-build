const { execFileSync, spawnSync } = require('child_process')
const { mkdirSync, mkdtempSync, writeFileSync } = require('fs')
const { tmpdir } = require('os')
const { dirname, join } = require('path')

const test = require('ava')

const {
  BUILD,
  SKIP,
  getDeployRange,
  decideFromChangedFiles,
  decideFromNx,
} = require('../src/affected')
const { run } = require('../bin/ignore')
const plugin = require('../src')

const options = { projectRoot: 'apps/shop', appsDir: 'apps' }

test('a change in the project itself builds', (t) => {
  const result = decideFromChangedFiles(
    ['apps/blog/src/a.ts', 'apps/shop/src/b.ts'],
    options,
  )
  t.is(result.decision, BUILD)
})

test('changes only in other apps skip', (t) => {
  const result = decideFromChangedFiles(
    ['apps/blog/src/a.ts', 'apps/admin/vite.config.ts'],
    options,
  )
  t.is(result.decision, SKIP)
})

test('a library change builds', (t) => {
  const result = decideFromChangedFiles(
    ['apps/blog/src/a.ts', 'libs/ui/src/button.tsx'],
    options,
  )
  t.is(result.decision, BUILD)
})

test('root config and lockfile changes build', (t) => {
  t.is(decideFromChangedFiles(['package-lock.json'], options).decision, BUILD)
  t.is(decideFromChangedFiles(['nx.json'], options).decision, BUILD)
})

test('an app whose name prefixes another app is not confused with it', (t) => {
  const result = decideFromChangedFiles(['apps/shop-admin/src/a.ts'], options)
  t.is(result.decision, SKIP)
})

test('ignored paths do not trigger a build', (t) => {
  const result = decideFromChangedFiles(['docs/setup.md', '.github/ci.yml'], {
    ...options,
    ignorePaths: ['docs/', '.github/'],
  })
  t.is(result.decision, SKIP)
})

test('ignored paths never hide a change in the project itself', (t) => {
  const result = decideFromChangedFiles(['apps/shop/README.md'], {
    ...options,
    ignorePaths: ['apps/'],
  })
  t.is(result.decision, BUILD)
})

test('the deploy range builds when there is nothing to compare', (t) => {
  t.is(getDeployRange({}).decision, BUILD)
  t.is(
    getDeployRange({ CACHED_COMMIT_REF: 'a', COMMIT_REF: 'a' }).decision,
    BUILD,
  )
  t.is(
    getDeployRange({
      CACHED_COMMIT_REF: 'a',
      COMMIT_REF: 'b',
      NX_FORCE_DEPLOYMENT: 'true',
    }).decision,
    BUILD,
  )
  t.deepEqual(getDeployRange({ CACHED_COMMIT_REF: 'a', COMMIT_REF: 'b' }), {
    base: 'a',
    head: 'b',
  })
})

test('nx decision matches the exact project name', (t) => {
  t.is(decideFromNx('shop', ['shop-admin', 'blog']).decision, SKIP)
  t.is(decideFromNx('shop', ['blog', 'shop']).decision, BUILD)
})

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function commit(cwd, file) {
  mkdirSync(dirname(join(cwd, file)), { recursive: true })
  writeFileSync(join(cwd, file), String(Math.random()))
  git(cwd, 'add', '-A')
  git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', file)
  return git(cwd, 'rev-parse', 'HEAD')
}

function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), 'nx-skip-build-'))
  git(cwd, 'init', '-q')
  return cwd
}

test('ignore command diffs the real deploy range', (t) => {
  const cwd = workspace()
  const first = commit(cwd, 'apps/shop/src/main.ts')
  const other = commit(cwd, 'apps/blog/src/main.ts')
  const lib = commit(cwd, 'libs/ui/index.ts')
  const env = { PROJECT_NAME: 'shop' }

  t.is(
    run({ ...env, CACHED_COMMIT_REF: first, COMMIT_REF: other }, cwd).decision,
    SKIP,
  )
  t.is(
    run({ ...env, CACHED_COMMIT_REF: other, COMMIT_REF: lib }, cwd).decision,
    BUILD,
  )
})

test('ignore command builds when PROJECT_NAME or the base commit is missing', (t) => {
  const cwd = workspace()
  const head = commit(cwd, 'apps/blog/src/main.ts')
  t.is(run({ CACHED_COMMIT_REF: 'x', COMMIT_REF: head }, cwd).decision, BUILD)
  t.is(
    run(
      {
        PROJECT_NAME: 'shop',
        CACHED_COMMIT_REF: '0123456789abcdef0123456789abcdef01234567',
        COMMIT_REF: head,
      },
      cwd,
    ).decision,
    BUILD,
  )
})

test('ignore command exits 0 to skip and 1 to build', (t) => {
  const cwd = workspace()
  const first = commit(cwd, 'apps/shop/src/main.ts')
  const other = commit(cwd, 'apps/blog/src/main.ts')
  const bin = join(__dirname, '..', 'bin', 'ignore.js')
  const exec = (project) =>
    spawnSync(process.execPath, [bin], {
      cwd,
      env: {
        ...process.env,
        PROJECT_NAME: project,
        CACHED_COMMIT_REF: first,
        COMMIT_REF: other,
      },
    }).status

  t.is(exec('shop'), 0)
  t.is(exec('blog'), 1)
})

function runPlugin(cwd, env) {
  const saved = { ...process.env }
  const savedCwd = process.cwd()
  Object.assign(process.env, env)
  process.chdir(cwd)
  let cancelled = false
  try {
    plugin.onPreBuild({
      utils: { build: { cancelBuild: () => (cancelled = true) } },
      constants: { PUBLISH_DIR: 'dist/apps/shop' },
    })
  } finally {
    process.chdir(savedCwd)
    process.env = saved
  }
  return cancelled
}

test('plugin cancels only projects nx does not report as affected', (t) => {
  const cwd = workspace()
  const first = commit(cwd, 'apps/shop/src/main.ts')
  const other = commit(cwd, 'apps/blog/src/main.ts')
  const nx = join(cwd, 'node_modules', '.bin', 'nx')
  mkdirSync(dirname(nx), { recursive: true })
  writeFileSync(nx, '#!/bin/sh\nprintf "blog\\nshop-admin\\n"\n', {
    mode: 0o755,
  })
  const range = { CACHED_COMMIT_REF: first, COMMIT_REF: other }

  t.true(runPlugin(cwd, { ...range, PROJECT_NAME: 'shop' }))
  t.false(runPlugin(cwd, { ...range, PROJECT_NAME: 'blog' }))
})

test('plugin builds instead of cancelling when nx cannot run', (t) => {
  const cwd = workspace()
  const first = commit(cwd, 'apps/shop/src/main.ts')
  const other = commit(cwd, 'apps/blog/src/main.ts')
  t.false(
    runPlugin(cwd, {
      PROJECT_NAME: 'shop',
      CACHED_COMMIT_REF: first,
      COMMIT_REF: other,
    }),
  )
})
