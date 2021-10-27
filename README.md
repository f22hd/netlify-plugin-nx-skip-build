

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


### Important notes:
The plugin requires an app output folder name identical to the project name under the apps folder.

Example:

```
app-name: example
output: dist/apps/example
```


### Resources

- [netlify-blog](https://www.netlify.com/blog/2020/04/21/deploying-nx-monorepos-to-netlify/)



### Contribution

Your suggestions and contribution are very welcome to make this plugin helpful.
