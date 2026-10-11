const { execFileSync } = require('child_process')
const { existsSync } = require('fs')
const { basename, join } = require('path')

const BUILD = 'build'
const SKIP = 'skip'

// Shared by the build plugin and the `ignore` command. Every answer that is not
// a confident "nothing this project depends on changed" is BUILD: a skipped
// deploy that should have shipped is worse than a build that was not needed.
function getDeployRange(env) {
  if (env.NX_FORCE_DEPLOYMENT === 'true') {
    return { decision: BUILD, reason: 'NX_FORCE_DEPLOYMENT is true' }
  }
  const base = env.CACHED_COMMIT_REF
  const head = env.COMMIT_REF
  if (!base || !head) {
    return { decision: BUILD, reason: 'no previous deploy to compare against' }
  }
  if (base === head) {
    return {
      decision: BUILD,
      reason: 'first deploy, or a redeploy of the same commit',
    }
  }
  return { base, head }
}

function parseList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function withSlash(dir) {
  return dir.replace(/\/+$/, '') + '/'
}

// Pre-install check: it only sees file paths, so the only changes it may
// ignore are ones inside ANOTHER project's directory (Nx apps cannot import
// each other) and paths the user listed as irrelevant. Libraries, root config
// and lockfiles always mean BUILD; the nx check in onPreBuild refines those.
function decideFromChangedFiles(files, options) {
  const projectRoot = withSlash(options.projectRoot)
  const appsDir = withSlash(options.appsDir || 'apps')
  const ignorePaths = options.ignorePaths || []

  if (files.length === 0) {
    return { decision: SKIP, reason: 'no files changed' }
  }
  const relevant = files.find((file) => {
    if (file.startsWith(projectRoot)) return true
    if (ignorePaths.some((path) => file.startsWith(path))) return false
    return !file.startsWith(appsDir)
  })
  if (relevant) {
    return { decision: BUILD, reason: `${relevant} changed` }
  }
  return {
    decision: SKIP,
    reason: `all ${files.length} changed files are outside ${projectRoot}`,
  }
}

function changedFiles(base, head, cwd) {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', base, head],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return output.split('\n').filter(Boolean)
}

// The nx project a site deploys. Netlify sets no variable for it, so it is
// derived from what Netlify does pass the plugin: the package directory
// (`apps/<app>`) or the publish directory (`dist/apps/<app>`). PROJECT_NAME
// overrides both.
function resolveProjectName(env, constants) {
  if (env.PROJECT_NAME) {
    return { name: env.PROJECT_NAME, source: 'PROJECT_NAME' }
  }
  if (constants.PACKAGE_PATH) {
    return {
      name: basename(constants.PACKAGE_PATH),
      source: 'package directory',
    }
  }
  return { name: basename(constants.PUBLISH_DIR), source: 'publish directory' }
}

function decideFromNx(project, affected, known) {
  // A derived name that is not an nx project would never appear in the
  // affected list, so cancelling on it would stop the site deploying for good.
  if (!known.includes(project)) {
    return {
      decision: BUILD,
      reason: `${project} is not an nx project in this workspace; set PROJECT_NAME to the project this site deploys`,
    }
  }
  if (affected.includes(project)) {
    return { decision: BUILD, reason: `${project} is affected` }
  }
  return {
    decision: SKIP,
    reason: `${project} was not affected by the latest changes`,
  }
}

function runNx(args, cwd) {
  const localNx = join(cwd, 'node_modules', '.bin', 'nx')
  const [command, prefix] = existsSync(localNx)
    ? [localNx, []]
    : ['npx', ['--no-install', 'nx']]
  const output = execFileSync(command, prefix.concat(args), {
    cwd,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { NX_DAEMON: 'false' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function nxProjects(cwd) {
  return runNx(['show', 'projects'], cwd)
}

function nxAffectedProjects(base, head, cwd) {
  return runNx(
    ['show', 'projects', '--affected', `--base=${base}`, `--head=${head}`],
    cwd,
  )
}

module.exports = {
  BUILD,
  SKIP,
  getDeployRange,
  parseList,
  decideFromChangedFiles,
  changedFiles,
  resolveProjectName,
  decideFromNx,
  nxProjects,
  nxAffectedProjects,
}
