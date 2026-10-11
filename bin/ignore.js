#!/usr/bin/env node
// Netlify `[build] ignore` command. Runs after the clone and BEFORE dependencies
// are installed, so a skipped build costs seconds instead of a full `npm ci`.
// Netlify exit codes: 0 = skip the build, 1 = build.
const {
  BUILD,
  SKIP,
  getDeployRange,
  parseList,
  decideFromChangedFiles,
  changedFiles,
} = require('../src/affected')

function run(env, cwd) {
  const project = env.PROJECT_NAME
  if (!project) {
    return { decision: BUILD, reason: 'PROJECT_NAME is not set' }
  }
  const range = getDeployRange(env)
  if (range.decision) return range

  const appsDir = env.NX_SKIP_APPS_DIR || 'apps'
  let files
  try {
    files = changedFiles(range.base, range.head, cwd)
  } catch (error) {
    return {
      decision: BUILD,
      reason: `could not diff ${range.base}..${range.head}: ${error.message}`,
    }
  }
  return decideFromChangedFiles(files, {
    projectRoot: env.NX_SKIP_PROJECT_ROOT || `${appsDir}/${project}`,
    appsDir,
    ignorePaths: parseList(env.NX_SKIP_IGNORE_PATHS),
  })
}

if (require.main === module) {
  const { decision, reason } = run(process.env, process.cwd())
  const project = process.env.PROJECT_NAME || 'this site'
  console.log(
    decision === SKIP
      ? `nx-skip-build: skipping ${project}, ${reason}`
      : `nx-skip-build: building ${project}, ${reason}`,
  )
  process.exitCode = decision === SKIP ? 0 : 1
}

module.exports = { run }
