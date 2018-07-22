<div align="center">
  <div>
    <img width="500" src="https://res.cloudinary.com/adonisjs/image/upload/q_100/v1532274184/Dimer_Readme_Banner_lyy7wv.svg" alt="Dimer App">
  </div>
  <br>
  <p>
    <a href="https://dimerapp.com/what-is-dimer">
      Dimer is an open source project and CMS to help you publish your documentation online.
    </a>
  </p>
  <br>
  <p>
    <sub>We believe every project/product is incomplete without documentation. <br /> We want to help you publish user facing documentation, without worrying <code>about tools or code</code> to write.</sub>
  </p>
  <br>
</div>

[![travis-image]][travis-url]
[![npm-image]][npm-url]

# Dimer datastore

Dimer datastore saves the websites, their versions and documents for each version.

The datastore operates on JSON flat files and exposes API to mutate and read the store.

## Installation

```bash
npm i @dimerapp/datastore

# Yarn
yarn add @dimerapp/datastore
```

## Data Structure
Following is the data structure of all the nodes inside the store. The `required` properties are required to mutate the store.

#### Site
Site is a given website, with it's own domain.

| Key | Value | Required | Description |
|-----|-------|---------|--------------|
| `domain` | String | YES | The domain of the website. If it's stored on dimer servers, then this is the subdomain `test.dimerapp.com` |
| cname | String | NO | CNAME to dimer subdomain |
| settings | Object | NO | An arbitrary object containing website settings. This is usually used by the themes |

#### Versions
Each website has one or more versions of documentation.

| Key | Value | Required | Description |
|-----|-------|---------|--------------|
| no **(unique)** | String | YES | The version number. It must be  URL friendly |
| name | String | No | Version no will be used as the name if not defined.
| default | Boolean | False | Is this the default version for documentation. If not defined, the greatest number will be considered as the default version. |
| depreciated | Boolean | False | Is this version depreciated |
| draft | Boolean | False | Is this version a draft |

#### Docs
The documentation node associated with a version always.

| Key | Value | Required | Description |
|-----|-------|---------|--------------|
| content | Object | Yes | The `object` of nodes, returned by [@dimerapp/markdown](https://github.com/dimerapp/markdown).
| permalink **(unique)** | String | Yes | The unique permalink for the doc. This is the URL people will visit to read the doc |
| title | String | No | The `title` for the document. First `h1` will be used if missing.
| jsonPath | String | Yes | The relative path, where the `content` should be saved |
| summary | String | No | The document social summary. If missing will be fetched from the `content`.
| redirects | Array[String] | No | An array of permalinks to be redirected to this document. |

## Usage
After installation you can grab the datastore as follows and save documents.

```js
const Datastore = require('@dimerapp/datastore')

const domain = 'adonisjs.dimerapp.com'
const store = new Datastore(domain)
```

#### saveDoc(versionNo, filePath, doc)
Save a new doc to the datastore. 

- If the version is missing, it will be created on the fly.
- If `filePath` exists, the doc will be updated.
- If `permalink `exists, an exception will be raised.

```js
const markdown = new Markdown('# Hello world')
const content = await markdown.toJSON()

await store.saveDoc('1.0.0', 'introduction.md', {
  permalink: 'introduction',
  content: content
})
```

#### removeDoc(versionNo, filePath)
Remove doc from the store.

```js
await store.removeDoc('1.0.0', 'introduction.md')
```

#### syncVersions(versions)
Sync an array of versions with the existing one's. Since all versions are saved inside the config `dimer.json` file, it is impossible to detect which version was added and which was removed to perform individual operations like `add`, `remove`. For the very same reason, datastore exposes the API to sync them.

```js
await store.syncVersions([
 {
   no: 'master',
   name: 'Version master',
   default: true
 },
 {
   no: 'v4.0',
   name: 'Version 4.0'
 },
 {
   no: 'v3.0',
   name: 'Version 3.0',
   depreciated: true
 }
])
```

#### getVersions
Returns an array of saved versions.

```js
store.getVersions()
```

#### getTree(versionNo, limit = 0, withContent = false)
Get an array of all the docs. Ideally you want this array to create a navigation menu and then on each request, you can ask for the doc content. However...

- You can pass `withContent=true` and the array will have the actual content for the doc too.
- Setting `limit=0` will return all the docs.
- All docs will be grouped by categories.

```js
const tree = await store.getTree('v4.0')

// output
[
 {
   category: 'Getting started',
   docs: [{
     permalink: ''
   }]
 }
]
```

#### getDoc(versionNo, filePath)
Returns the doc meta data and it's content.

```js
const doc = await store.getDoc('v4.0', 'introduction.md')
```

#### getDocByPermalink(versionNo, permalink)
Returns the doc by it's permalink.

```js
const doc = await store.getDocByPermalink('v4.0', '/introduction')
```

#### redirectedPermalink(versionNo, permalink)
Returns the new permalink at which the doc must be redirected.

```js
const redirectTo = store.redirectedPermalink('v4.0', '/old-introduction')

if (redirectTo) {
  // redirect to this location
}
```

#### syncConfig(config)
Sync the `config` file with the datastore.

```js
await store.syncConfig(require('./dimer.json'))
```

#### getConfig
Returns the synced config

```js
const config = store.getConfig()
```

## Search
The datastore builds a search index based on [elasticlunr](http://elasticlunr.com/), which can be used for indexing a individual version and then performing search queries for same.

**ALWAYS MAKE SURE TO CREATE SEARCH INDEXES AT LAST. SAVING A NEW DOC WILL NOT UPDATE THE INDEX**.

```js
await store.indexVersion('v4.0')
```

And then later search

```js
const results = await store.search('v4.0', 'What is AdonisJs?')
```

## Change log

The change log can be found in the [CHANGELOG.md](https://github.com/dimerapp/md-serve/CHANGELOG.md) file.

## Contributing

Everyone is welcome to contribute. Please take a moment to review the [contributing guidelines](CONTRIBUTING.md).

## Authors & License
[thetutlage](https://github.com/thetutlage) and [contributors](https://github.com/dimerapp/md-serve/graphs/contributors).

MIT License, see the included [MIT](LICENSE.md) file.

[travis-image]: https://img.shields.io/travis/dimerapp/md-serve/master.svg?style=flat-square&logo=travis
[travis-url]: https://travis-ci.org/dimerapp/md-serve "travis"

[npm-image]: https://img.shields.io/npm/v/md-serve.svg?style=flat-square&logo=npm
[npm-url]: https://npmjs.org/package/md-serve "npm"
