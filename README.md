# Datastore
> Flat database for Dimer websites

[![travis-image]][travis-url]
[![appveyor-image]][appveyor-url]
[![npm-image]][npm-url]
![](https://img.shields.io/badge/Uses-Typescript-294E80.svg?style=flat-square&colorA=ddd)

Datastore is used by the Dimer to store compiled docs and details about a website in flat JSON files.

Datastore is built the following principles:

1. Strive for reproducibility
2. Keep datastorage small
3. Favor correctness over minor speed improvements.


## Strive for reproducibility

Datastore strives for consistent builds, regardless of the previous state the project has been in. We achieve this by re-building the project from scratch every time and this helps in couple of things.

1. Avoid edge case conflicts, where the source files have been changed and output is not reflecting them.
2. Forces us to improve the speed of entire build process, since we build it every time from ground up.

This idea is not new and used by build tools like **Webpack**, **Babel** and so on (in frontend space).

Re-building the project from ground up avoids a whole class of state diffing errors. Also, matching current state with the previous state at times can be more expensive than re-building the project from scratch.


## Keep datastorage small

We attempt to make sure that the saved JSON files doesn't take a whole lot of space. We do this by not defining fallback values for optional fields. For example: 

The **version name** is optional, and we do not substitute it with **version no** during the save operation. However, when during the HTTP API calls, we provide and return fallback values.

Another option is to look for other formats than JSON, which can result in smaller and faster output and we are looking into it.

## Favour correctness over minor speed improvements

Making sure the state of the documentation is in right shape is the primary priority of `datastore` and we can sacrifice some speed improvements for that.

## Usage

Let's dive into the usage of this module. The module comes with a **write only API**.


```js
const { ConfigParser, Datastore } = require('@dimerapp/datastore')
const { Context } = require('@dimerapp/context')
const { join } = require('path')

const ctx = new Context()

// Build path is used by datastore to output JSON files
context.addPath('build', join(__dirname, build))

// Used by different modules to read source files
context.addPath('appRoot', __dirname)
```


Next step is to parse the config file `dimer.json`. A project without this file is not a dimer project. 

```js
const parser = new ConfigParser(ctx)

const { errors, parsedConfig } = await parser.parse()

// Initial config has errors
if (errors.length) {
  
} else {
  // Continue
}
```


Next step is to pass the parsed config file to the datastore, so that it can parse and store all zones and versions.

```js
const db = new Datastore(ctx)

// Returns the versions diff
const diff = db.syncConfig(parseConfig)
```

The versions diff is the an object with all the details to find which `versions` have been changed, added or removed since the last `sync`. This is useful when you have a file watcher watching the files.

The initial diff will always have everything under `added` array.

```js
const versions = diff.added.concat(diff.updated)

// Remove version docs from the disk
Promise.all(diff.removed.map((version) => {
  return version.cleanup()
}))
```

Calling `db.commit` anytime will write the `meta.json` file to the disk.

```js
await db.commit()
```


## Change log

The change log can be found in the [CHANGELOG.md](CHANGELOG.md) file.

## Contributing

Everyone is welcome to contribute. Please take a moment to review the [contributing guidelines](CONTRIBUTING.md).

## Authors & License
[Harminder Virk](https://github.com/Harminder Virk) and [contributors](https://github.com/null/null/graphs/contributors).

MIT License, see the included [MIT](LICENSE.md) file.

[travis-image]: https://img.shields.io/travis/dimerapp/datastore/master.svg?style=flat-square&logo=travis
[travis-url]: https://travis-ci.org/dimerapp/datastore "travis"

[appveyor-image]: https://img.shields.io/appveyor/ci/thetutlage/datastore/master.svg?style=flat-square&logo=appveyor
[appveyor-url]: https://ci.appveyor.com/project/thetutlage/datastore "appveyor"

[npm-image]: https://img.shields.io/npm/v/@dimerapp/datastore.svg?style=flat-square&logo=npm
[npm-url]: https://npmjs.org/package/@dimerapp/datastore "npm"
