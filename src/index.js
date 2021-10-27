const { basename } = require('path');

module.exports = {
  onPreBuild: ({ utils, constants }) => {
      const projectName = process.env.PROJECT_NAME || basename(constants.PUBLISH_DIR);
      const lastDeployedCommit = process.env.CACHED_COMMIT_REF
      const latestCommit = 'HEAD'
      const projectHasChanged = projectChanged(
        projectName,
        lastDeployedCommit,
        latestCommit,
      )
      if (!projectHasChanged) {
        utils.build.cancelBuild(
          `Build was cancelled because ${projectName} was not affected by the latest changes`,
        )
      }
  },
}
// eslint-disable-next-line no-unused-vars
function projectChanged(currentProject, fromHash, toHash) {
  const execSync = require('child_process').execSync
  const getAffected = `nx print-affected  --plain --base=${fromHash} --head=${toHash}`;
  const output = execSync(getAffected).toString()
  //get the list of changed projects from the output
  const changedProjects = JSON.parse(output).projects // array of affected projects
  return changedProjects.findIndex((project) => project === currentProject) > -1
}
