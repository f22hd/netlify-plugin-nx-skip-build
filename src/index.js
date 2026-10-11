const { basename } = require('path')

const {
  SKIP,
  getDeployRange,
  decideFromNx,
  nxAffectedProjects,
} = require('./affected')

module.exports = {
  onPreBuild: ({ utils, constants }) => {
    const projectName =
      process.env.PROJECT_NAME || basename(constants.PUBLISH_DIR)
    const range = getDeployRange(process.env)
    if (range.decision) {
      console.log(`nx-skip-build: building ${projectName}, ${range.reason}`)
      return
    }

    let affected
    try {
      affected = nxAffectedProjects(range.base, range.head, process.cwd())
    } catch (error) {
      // Fail open: an nx or git error must never drop a deploy.
      console.warn(
        `nx-skip-build: building ${projectName}, could not compute affected projects: ${
          error ? error.message : 'Unknown error'
        }`,
      )
      return
    }

    console.log(
      `nx-skip-build: affected between ${range.base} and ${range.head}: ${
        affected.join(', ') || '(none)'
      }`,
    )
    const { decision, reason } = decideFromNx(projectName, affected)
    if (decision === SKIP) {
      utils.build.cancelBuild(`Build was cancelled because ${reason}`)
      return
    }
    console.log(`nx-skip-build: building, ${reason}`)
  },
}
