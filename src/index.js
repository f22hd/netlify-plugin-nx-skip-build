const { basename } = require('path')

module.exports = {
  onPreBuild: ({ utils, constants }) => {
    const projectName =
      process.env.PROJECT_NAME || basename(constants.PUBLISH_DIR);
    const lastDeployedCommit = process.env.CACHED_COMMIT_REF;
    const latestCommit = process.env.COMMIT_REF;
    const firstDeployment =
      process.env.CACHED_COMMIT_REF === process.env.COMMIT_REF;
    const isForcedDeployment = process.env.NX_FORCE_DEPLOYMENT || false;

    const projectHasChanged = projectChanged(
      projectName,
      lastDeployedCommit,
      latestCommit,
    )

    if (!projectHasChanged && !firstDeployment && !isManualDeployment(isForcedDeployment)) {
      utils.build.cancelBuild(
        `Build was cancelled because ${projectName} was not affected by the latest changes`,
      )
    }
  },
}
// eslint-disable-next-line no-unused-vars
function projectChanged(currentProject, fromHash, toHash) {
  const execSync = require('child_process').execSync
  const getAffected = `nx print-affected  --plain --base=${fromHash} --head=${toHash}`
  const output = execSync(getAffected).toString()
  //get the list of changed projects from the output
  const changedProjects = JSON.parse(output).projects // array of affected projects
  return changedProjects.findIndex((project) => project === currentProject) > -1
}

function isManualDeployment(isForcedDeployment){
  return isForcedDeployment === 'true';
}
