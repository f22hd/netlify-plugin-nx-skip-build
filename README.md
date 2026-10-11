A Netlify Build plugin that skips not affected apps in your nx monorepo.

<p align="center">
  <a aria-label="npm version" href="https://www.npmjs.com/package/netlify-plugin-nx-skip-build">
    <img alt="" src="https://img.shields.io/npm/v/netlify-plugin-nx-skip-build">
  </a>
  <a aria-label="MIT License" href="https://www.npmjs.com/package/netlify-plugin-nx-skip-build">
    <img alt="" src="https://img.shields.io/npm/l/netlify-plugin-nx-skip-build">
  </a>
</p>

### Install

Install the module

```shell
npm i -D netlify-plugin-nx-skip-build
```

Add the plugin and the ignore command to `netlify.toml`

```toml
[build]
  ignore = "npx -y -p netlify-plugin-nx-skip-build@<version> nx-skip-build-ignore"

[[plugins]]
  package = "netlify-plugin-nx-skip-build"
```

Pin `<version>` to the version in your `package.json`.

### How does it work?

The check runs in two steps, because Netlify bills a build cancelled by the
plugin for the dependency install that ran before it.

1. **`ignore` command (before `npm install`).** Netlify runs it right after the
   clone, without your `node_modules`, so it cannot ask nx. It diffs
   `$CACHED_COMMIT_REF..$COMMIT_REF` and skips the build only when every changed
   file is inside **another app's** directory (`apps/<other-app>/`). A change to
   a library, a root config file or the lockfile means "build", and step 2
   decides.
2. **Build plugin (`onPreBuild`).** Runs
   `nx show projects --affected --base=$CACHED_COMMIT_REF --head=$COMMIT_REF`
   and cancels the build when the project is not in the list.

Both steps fail open: if a commit is missing, `git` or `nx` errors, or
`PROJECT_NAME` is not set, the site builds. A skipped deploy that should have
shipped is worse than an unneeded build.

Both steps compare against `$CACHED_COMMIT_REF`, the last commit Netlify built
for the site. If a build fails and an unrelated commit is pushed before you fix
it, that push can skip the site. Retry the failed deploy, or set
`NX_FORCE_DEPLOYMENT=true` for one build.

The first step assumes no app imports another app, which nx enforces by default.
If one of your apps depends on another, leave the `ignore` command out and rely
on the plugin only.

### Environment variables

| Variable               | Used by        | Description                                                                                                             |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PROJECT_NAME`         | both           | The nx project this site deploys. **Required for the `ignore` command.** The plugin falls back to the publish dir name. |
| `NX_FORCE_DEPLOYMENT`  | both           | `true` builds the site and skips all checks.                                                                            |
| `NX_SKIP_APPS_DIR`     | ignore command | The apps directory. Defaults to `apps`.                                                                                 |
| `NX_SKIP_PROJECT_ROOT` | ignore command | The project's directory. Defaults to `<NX_SKIP_APPS_DIR>/<PROJECT_NAME>`.                                               |
| `NX_SKIP_IGNORE_PATHS` | ignore command | Comma-separated path prefixes that never trigger a build, e.g. `docs/,.github/,.claude/`.                               |

Set them per site in the Netlify UI (recommended) or in your `.env` file.

### Resources

- [netlify-blog](https://www.netlify.com/blog/2020/04/21/deploying-nx-monorepos-to-netlify/)
- [Netlify: ignore builds](https://docs.netlify.com/configure-builds/ignore-builds/)

### Contribution

Your suggestions and contribution are very welcome to make this plugin helpful.
