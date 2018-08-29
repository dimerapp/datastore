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
| `domain` | String | NO | The domain of the website. If it's stored on dimer servers, then this is the subdomain `test.dimerapp.com` |
| cname | String | NO | CNAME to dimer subdomain |
| settings | Object | NO | An arbitrary object containing website settings. This is usually used by the themes |

#### Zones
Zones are the way to divide sections of your website docs into multiple top levels. For example: `Guides`, `API`, `FAQ's` and so on.

| Key | Value | Required | Description |
|-----|-------|----------|-------------|
| slug **(unique)** | String | Yes | The slug to be used for uniquely identifying the zone. |
| name | String | No | The display name for the zone |
| versions | Array | Yes | The versions for the zone |

#### Versions
Versions for a given zone. When your are not using zones, then the versions become the part of a virtual zone.

| Key | Value | Required | Description |
|-----|-------|---------|--------------|
| no **(unique)** | String | YES | The version number. It must be  URL friendly |
| name | String | No | Version no will be used as the name if not defined.
| default | Boolean | No | Is this the default version for documentation. If not defined, the greatest number will be considered as the default version. |
| depreciated | Boolean | No | Is this version depreciated |
| draft | Boolean | No | Is this version a draft |

#### Docs
The documentation node associated with a version always.

| Key | Value | Required | Description |
|-----|-------|---------|--------------|
| content | Object | Yes | The `object` of nodes, returned by [@dimerapp/markdown](https://github.com/dimerapp/markdown).
| permalink **(unique)** | String | Yes | The unique permalink for the doc. This is the URL people will visit to read the doc |
| title | String | Yes | The `title` for the document. First `h1` will be used if missing.
| jsonPath **(unique)** | String | Yes | The relative path, where the `content` should be saved |
| summary | String | No | The document social summary. If missing will be fetched from the `content`.
| redirects | Array[String] | No | An array of permalinks to be redirected to this document. |

## Usage
After installation you can grab the datastore as follows and save documents.

```js
const Datastore = require('@dimerapp/datastore')
const Context = require('@dimerapp/context')

const ctx = new Context(__dirname)
const store = new Datastore(ctx)

await store.load()
```

#### load(clean = false)
Load the data store to start mutating it, if store is not loaded, hard exceptions will be raised.

Also when you pass `clean=true`, it will load the store from a clean slate. It is helpful, when you want to build documentation from scratch.

```js
await store.load()

// from clean slate

await store.load(true)
```

#### saveDoc(zoneSlug, versionNo, filePath, doc)
Save a new doc to the datastore. 

- The `slug` for the zone. If missing, it will be created on the fly.
- If the version is missing, it will be created on the fly.
- If `filePath` exists, the doc will be updated.
- If `permalink `exists, an exception will be raised.

```js
const markdown = new Markdown('# Hello world')
const content = await markdown.toJSON()

// save actual doc
await store.saveDoc(
  'guides',
  '1.0.0',
  'introduction.md',
  {
    permalink: 'introduction',
    content: content
  }
)

// update meta data to database
await store.persist()
```

#### removeDoc(zoneSlug, versionNo, filePath)
Remove doc from the store.

```js
await store.removeDoc('guides', '1.0.0', 'introduction.md')

// update meta data to database
await store.persist()
```

#### syncZones(zones)
Syncs the zones inside the db. Also versions for each zone will be synced automatically. Each zone will have a diff node for versions too.

```js
const { added, updated, removed } = await store.syncZones(zones)
console.log(added.versions) // { added: [], updated: [], removed: [] }
```

#### syncVersions(zoneSlug, versions)
Sync an array of versions with the existing one's. Since all versions are saved inside the config `dimer.json` file, it is impossible to detect which version was added and which was removed to perform individual operations like `add`, `remove`. For the very same reason, datastore exposes the API to sync them.

```js
await store.syncVersions('guides', [
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

// update meta data to database
await store.persist()
```

#### getVersions(zoneSlug)
Returns an array of saved versions.

```js
store.getVersions('guides')
```

#### getTree(zoneSlug, versionNo, limit = 0, withContent = false, attachVersion = false)
Get an array of all the docs. Ideally you want this array to create a navigation menu and then on each request, you can ask for the doc content. However...

- You can pass `withContent=true` and the array will have the actual content for the doc too.
- Setting `limit=0` will return all the docs.
- All docs will be grouped by categories.
- When `attachVersion=true`. Each doc will contain it's version node.

```js
const tree = await store.getTree('guides', 'v4.0')

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

#### getDoc(zoneSlug, versionNo, filePath, attachVersion = false)
Returns the doc meta data and it's content.

- When `attachVersion=true`. Doc will contain it's version node.

```js
const doc = await store.getDoc('guides', 'v4.0', 'introduction.md')
```

#### getDocByPermalink(zoneSlug, versionNo, permalink, attachVersion = false)
Returns the doc by it's permalink.

- When `attachVersion=true`. Doc will contain it's version node.

```js
const doc = await store.getDocByPermalink('guides', 'v4.0', '/introduction')
```

#### redirectedPermalink(zoneSlug, versionNo, permalink)
Returns the new permalink at which the doc must be redirected.

```js
const redirectTo = store.redirectedPermalink('guides', 'v4.0', '/old-introduction')

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
await store.indexVersion('guides', 'v4.0')
```

And then later search

```js
const results = await store.search('guides', 'v4.0', 'What is AdonisJs?')
```

Following will be the output of search results

```js
[
  {
    ref: '/yaml-front-matter',
    marks: {
      body: [
        {
          type: 'raw',
          text: 'Yaml '
        },
        {
          type: 'mark',
          text: 'front'
        },
        {
          type: 'raw',
          text: ' '
        },
        {
          type: 'mark',
          text: 'matter'
        },
        {
          type: 'raw',
          text: ' is used for matching content'
        }
      ]
    }
  }
]
```

## Change log

The change log can be found in the [CHANGELOG.md](https://github.com/dimerapp/md-serve/CHANGELOG.md) file.

## Contributing

Everyone is welcome to contribute. Please take a moment to review the [contributing guidelines](CONTRIBUTING.md).

## Authors & License
[thetutlage](https://github.com/thetutlage) and [contributors](https://github.com/dimerapp/md-serve/graphs/contributors).

MIT License, see the included [MIT](LICENSE.md) file.

[travis-image]: https://img.shields.io/travis/dimerapp/datastore/master.svg?style=flat-square&logo=travis
[travis-url]: https://travis-ci.org/dimerapp/datastore "travis"

[npm-image]: https://img.shields.io/npm/v/@dimerapp/datastore.svg?style=flat-square&logo=npm
[npm-url]: https://npmjs.org/package/@dimerapp/datastore "npm"
