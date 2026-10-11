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

Add the plugin to `netlify.toml`

```toml
[[plugins]]
  package = "netlify-plugin-nx-skip-build"
```

That is all: no per-site configuration. The plugin works out which nx project a
site deploys from what Netlify passes it, in this order:

1. `PROJECT_NAME`, if you set it (an override, normally not needed).
2. The site's **package directory** (`apps/<app>` → `<app>`).
3. The site's **publish directory** (`dist/apps/<app>` → `<app>`).

If the derived name is not an nx project in the workspace, the site builds and
the log tells you to set `PROJECT_NAME`. It is never cancelled on a guess.

### How does it work?

In `onPreBuild` the plugin runs
`nx show projects --affected --base=$CACHED_COMMIT_REF --head=$COMMIT_REF` and
cancels the build when the project is not in the list. Every step logs what it
decided.

It fails open: if a commit is missing or `git`/`nx` errors, the site builds. A
skipped deploy that should have shipped is worse than an unneeded build.

It compares against `$CACHED_COMMIT_REF`, the last commit Netlify built for the
site. If a build fails and an unrelated commit is pushed before you fix it, that
push can skip the site. Retry the failed deploy, or set
`NX_FORCE_DEPLOYMENT=true` for one build.

### Optional: skip even earlier with the `ignore` command

Build plugins run after the dependency install. To skip before it, also add the
`nx-skip-build-ignore` bin as Netlify's ignore command:

```toml
[build]
  ignore = "npx -y -p netlify-plugin-nx-skip-build@<version> nx-skip-build-ignore"
```

Netlify passes the ignore step neither the package nor the publish directory
(only `SITE_NAME`/`SITE_ID`, and the working directory is the repository root),
so this step **requires `PROJECT_NAME` on each site**; without it the step just
lets the build continue and the plugin decides. It skips only when every changed
file is inside **another app's** directory (`apps/<other-app>/`), and assumes no
app imports another app, which nx enforces by default.

### Environment variables

All optional.

| Variable               | Used by        | Description                                                                               |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `PROJECT_NAME`         | both           | Overrides the derived nx project name. Required only for the `ignore` command.            |
| `NX_FORCE_DEPLOYMENT`  | both           | `true` builds the site and skips all checks.                                              |
| `NX_SKIP_APPS_DIR`     | ignore command | The apps directory. Defaults to `apps`.                                                   |
| `NX_SKIP_PROJECT_ROOT` | ignore command | The project's directory. Defaults to `<NX_SKIP_APPS_DIR>/<PROJECT_NAME>`.                 |
| `NX_SKIP_IGNORE_PATHS` | ignore command | Comma-separated path prefixes that never trigger a build, e.g. `docs/,.github/,.claude/`. |

### Resources

- [netlify-blog](https://www.netlify.com/blog/2020/04/21/deploying-nx-monorepos-to-netlify/)
- [Netlify: ignore builds](https://docs.netlify.com/configure-builds/ignore-builds/)

### Contribution

Your suggestions and contribution are very welcome to make this plugin helpful.
