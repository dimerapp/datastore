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

Processing docs using Dimer is a series of operations. Let's perform them one by one using this module.

### Step1: Parsing User Config

```js
const { ConfigParser } = require('@dimerapp/datastore')
const { Context } = require('@dimerapp/context')

const ctx = new Context()
ctx.addPath('appRoot', __dirname)

const parser = new ConfigParser(ctx)
const { errors, config } = await parser.parse()

if (errors.length) {
    errors.map((error) => console.log(error.message))
    return
}
```


1. The config parser will return an array of errors, which contains the `error.message` and `error.ruleId`.
2. If there aren't any errors, then `config` object will be a normalised object with parsed config.

### Step2: Sync zones and versions with datastore

```js
const { Datastore, Config } = require('@dimerapp/datastore')
const { Context } = require('@dimerapp/context')
const { join } = require('path')

const ctx = new Context()
ctx.addPath('appRoot', __dirname)
ctx.addPath('build', join(__dirname, 'dist'))

const parser = new ConfigParser(ctx)
const { errors, config } = await parser.parse()

if (errors.length) {
    errors.map((error) => console.log(error.message))
    return
}

const db = new Datastore(ctx)
const diff = db.syncConfig(config)

const versions = diff.added.concat(diff.updated)
```

1. The `syncConfig` method takes the parsed config and syncs it with the flat file database. The data is not written to the disk, unless we call `db.commit`.
2. The `diff` returned from the `syncConfig` method returns an array of versions for `added`, `updated` and `removed` keys.
3. We just want to process the `added` and `updated` versions and delete the content for the `removed` versions (in next step).

### Step3: Reading markdown files and processing them

```js
const { Datastore, Config, Reader, ConfigParser } = require('@dimerapp/datastore')
const { Context } = require('@dimerapp/context')
const { join } = require('path')

const ctx = new Context()
ctx.addPath('appRoot', __dirname)
ctx.addPath('build', join(__dirname, 'dist'))

const parser = new ConfigParser(ctx)
const { errors, config } = await parser.parse()

if (errors.length) {
    errors.map((error) => console.log(error.message))
    return
}

const db = new Datastore(ctx)

const diff = db.syncConfig(config)
const versions = diff.added.concat(diff.updated)

async function processVersion (version) {
  const reader = new Reader(ctx, version)

  try {
    const tree = await reader.getTree()
    // an array of markdown files
    
  } catch (error) {
    // Something blowed up
  }
}

// we can safely process versions in parallel
await Promise.all(versions.map((version) => {
  return processVersion(version)
}))
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
