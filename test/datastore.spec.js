/*
* md-serve
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const fs = require('fs-extra')
const { join, win32 } = require('path')
const test = require('japa')
const Markdown = require('@dimerapp/markdown')
const dedent = require('dedent')
const _ = require('lodash')
const Context = require('@dimerapp/context')

const Datastore = require('../src/Datastore')

const baseDir = join(__dirname, 'sites')
const domainDir = join(baseDir, 'dist', '__api')

const ctx = new Context(baseDir)

test.group('Datastore', (group) => {
  group.afterEach(async () => {
    await fs.remove(baseDir)
  })

  test('raise error when zoneSlug, versionNo or fileName is missing when saving doc', async (assert) => {
    assert.plan(1)

    const store = new Datastore(ctx)

    try {
      await store.saveDoc()
    } catch ({ message }) {
      assert.equal(message, 'Expected `zoneSlug` to be of type `string` but received type `undefined`')
    }
  })

  test('save markdown json and it\'s meta data to the disk', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello',
      permalink: '/hello',
      category: 'root',
      content: {
        type: 'root',
        children: [{}]
      }
    })

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, 'guides', '1.0.0', 'foo.json'))

    assert.deepEqual(doc, { type: 'root', children: [{}] })
    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            draft: false,
            default: false,
            depreciated: false,
            docs: [
              {
                jsonPath: 'foo.json',
                permalink: '/hello',
                title: 'Hello',
                category: 'root'
              }
            ]
          }
        ]
      }]
    })
  })

  test('raise error when title is missing', async (assert) => {
    assert.plan(1)

    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [
        {
          t: 'elem',
          tag: 'dimertitle',
          children: [{ t: 'text', value: 'Hello world' }]
        }
      ]
    }

    try {
      await store.saveDoc('guides', '1.0.0', 'foo.md', {
        permalink: '/hello',
        category: 'root',
        content: nodes
      })
    } catch ({ message }) {
      assert.equal(message, 'Expected object `doc` to have keys `["title"]`')
    }
  })

  test('set category to root when is not inside meta data', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, 'guides', '1.0.0', 'foo.json'))

    assert.deepEqual(doc, nodes)
    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            draft: false,
            default: false,
            depreciated: false,
            docs: [
              {
                jsonPath: 'foo.json',
                permalink: '/hello',
                title: 'Hello world',
                category: 'root'
              }
            ]
          }
        ]
      }]
    })
  })

  test('sync versions', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const { added, removed } = await store.syncVersions('guides', [
      {
        no: '1.0.0'
      },
      {
        no: '1.0.1',
        default: true
      }
    ])

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))

    assert.deepEqual(removed, [])
    assert.deepEqual(added, metaFile.zones[0].versions.map((v) => _.omit(v, 'docs')))

    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            default: false,
            depreciated: false,
            draft: false,
            docs: []
          },
          {
            no: '1.0.1',
            name: '1.0.1',
            default: true,
            depreciated: false,
            draft: false,
            docs: []
          }
        ]
      }]
    })
  })

  test('sync versions with existing content should work fine', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const { removed, added } = await store.syncVersions('guides', [
      {
        no: '1.0.0',
        name: 'Version 1'
      },
      {
        no: '1.0.1',
        default: true
      }
    ])

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(removed, [])
    assert.deepEqual(added, [
      {
        no: '1.0.1',
        name: '1.0.1',
        default: true,
        depreciated: false,
        draft: false
      }
    ])

    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: 'Version 1',
            default: false,
            depreciated: false,
            draft: false,
            docs: [
              {
                jsonPath: 'foo.json',
                permalink: '/hello',
                category: 'root',
                title: 'Hello world'
              }
            ]
          },
          {
            no: '1.0.1',
            name: '1.0.1',
            default: true,
            depreciated: false,
            draft: false,
            docs: []
          }
        ]
      }]
    })
  })

  test('sync versions should remove the one\'s not inside the array', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.saveDoc('guides', '1.0.1', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const { removed, added } = await store.syncVersions('guides', [
      {
        no: '1.0.0',
        name: 'Version 1'
      }
    ])

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(added, [])
    assert.deepEqual(removed, [
      {
        no: '1.0.1',
        name: '1.0.1',
        default: false,
        depreciated: false,
        draft: false
      }
    ])

    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: 'Version 1',
            default: false,
            depreciated: false,
            draft: false,
            docs: [
              {
                jsonPath: 'foo.json',
                permalink: '/hello',
                category: 'root',
                title: 'Hello world'
              }
            ]
          }
        ]
      }]
    })
  })

  test('sync versions should add the one\'s not already exists', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.1', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const { added, removed } = await store.syncVersions('guides', [
      {
        no: '1.0.0',
        name: 'Version 1'
      }
    ])

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(removed, [
      {
        no: '1.0.1',
        name: '1.0.1',
        default: false,
        depreciated: false,
        draft: false
      }
    ])

    assert.deepEqual(added, [
      {
        no: '1.0.0',
        name: 'Version 1',
        default: false,
        depreciated: false,
        draft: false
      }
    ])

    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: 'Version 1',
            default: false,
            depreciated: false,
            draft: false,
            docs: []
          }
        ]
      }]
    })
  })

  test('sync versions should remove the content for one\'s not inside the array', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.saveDoc('guides', '1.0.1', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    let v1 = await fs.pathExists(join(domainDir, 'guides', '1.0.0', 'foo.json'))
    let v2 = await fs.pathExists(join(domainDir, 'guides', '1.0.1', 'foo.json'))
    assert.isTrue(v1)
    assert.isTrue(v2)

    await store.syncVersions('guides', [
      {
        no: '1.0.0',
        name: 'Version 1'
      }
    ])

    await store.persist()

    v1 = await fs.pathExists(join(domainDir, 'guides', '1.0.0', 'foo.json'))
    v2 = await fs.pathExists(join(domainDir, 'guides', '1.0.1', 'foo.json'))
    assert.isTrue(v1)
    assert.isFalse(v2)

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: 'Version 1',
            default: false,
            depreciated: false,
            draft: false,
            docs: [
              {
                jsonPath: 'foo.json',
                permalink: '/hello',
                category: 'root',
                title: 'Hello world'
              }
            ]
          }
        ]
      }]
    })
  })

  test('remove a given doc', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.removeDoc('guides', '1.0.0', 'foo.md')
    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const foo = await fs.pathExists(join(domainDir, 'guides', '1.0.0', 'foo.json'))
    assert.isFalse(foo)

    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            default: false,
            depreciated: false,
            draft: false,
            docs: []
          }
        ]
      }]
    })
  })

  test('skip when removing doc for a non-existing version', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.removeDoc('guides', '1.0.1', 'foo.md')
    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const foo = await fs.pathExists(join(domainDir, 'guides', '1.0.0', 'foo.json'))
    assert.isTrue(foo)

    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            default: false,
            depreciated: false,
            draft: false,
            docs: [
              {
                title: 'Hello world',
                permalink: '/hello',
                category: 'root',
                jsonPath: 'foo.json'
              }
            ]
          }
        ]
      }]
    })
  })

  test('return an array of versions', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('faq', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const versions = store.getVersions('faq')
    assert.deepEqual(versions, [
      {
        no: '1.0.0',
        name: '1.0.0',
        default: false,
        depreciated: false,
        draft: false,
        heroDoc: {
          jsonPath: 'foo.json',
          title: 'Hello world',
          permalink: '/hello',
          category: 'root'
        }
      }
    ])
  })

  test('get docs as an array for a version', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const docs = await store.getTree('guides', '1.0.0')
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            title: 'Hello world',
            permalink: '/hello',
            category: 'root'
          }
        ]
      }
    ])
  })

  test('return null when version doesn\'t exists', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const docs = await store.getTree('api', '1.0.1')
    assert.isNull(docs)
  })

  test('return null when zone doesn\'t exists', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const docs = await store.getTree('guides', '1.0.0')
    assert.isNull(docs)
  })

  test('order docs by jsonPath', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.saveDoc('api', '1.0.0', 'bar.md', {
      title: 'Hello world',
      permalink: '/bar',
      content: nodes
    })

    const docs = await store.getTree('api', '1.0.0')
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            title: 'Hello world',
            permalink: '/bar',
            category: 'root'
          },
          {
            title: 'Hello world',
            permalink: '/hello',
            category: 'root'
          }
        ]
      }
    ])
  })

  test('load content for docs', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.saveDoc('api', '1.0.0', 'bar.md', {
      title: 'Hello world',
      permalink: '/bar',
      content: nodes
    })

    const docs = await store.getTree('api', '1.0.0', 0, true)
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            title: 'Hello world',
            permalink: '/bar',
            category: 'root',
            content: nodes
          },
          {
            title: 'Hello world',
            permalink: '/hello',
            category: 'root',
            content: nodes
          }
        ]
      }
    ])
  })

  test('load content for docs with versions node', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.saveDoc('api', '1.0.0', 'bar.md', {
      title: 'Hello world',
      permalink: '/bar',
      content: nodes
    })

    const docs = await store.getTree('api', '1.0.0', 0, true, true)
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            title: 'Hello world',
            permalink: '/bar',
            category: 'root',
            content: nodes,
            version: {
              no: '1.0.0',
              name: '1.0.0',
              default: false,
              depreciated: false,
              draft: false
            }
          },
          {
            title: 'Hello world',
            permalink: '/hello',
            category: 'root',
            content: nodes,
            version: {
              no: '1.0.0',
              name: '1.0.0',
              default: false,
              depreciated: false,
              draft: false
            }
          }
        ]
      }
    ])
  })

  test('limit docs', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.saveDoc('guides', '1.0.0', 'bar.md', {
      title: 'Hello world',
      permalink: '/bar',
      content: nodes
    })

    const docs = await store.getTree('guides', '1.0.0', 1, true)
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            title: 'Hello world',
            permalink: '/bar',
            category: 'root',
            content: nodes
          }
        ]
      }
    ])
  })

  test('get a single doc', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await store.getDoc('guides', '1.0.0', 'foo.json')
    assert.deepEqual(doc, {
      title: 'Hello world',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })
  })

  test('attach version node to a single doc', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await store.getDoc('guides', '1.0.0', 'foo.json', true)

    assert.deepEqual(doc, {
      title: 'Hello world',
      permalink: '/hello',
      category: 'root',
      content: nodes,
      version: {
        no: '1.0.0',
        name: '1.0.0',
        draft: false,
        default: false,
        depreciated: false
      }
    })
  })

  test('return null when single doc is missing', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await store.getDoc('guides', '1.0.0', 'bar.json')
    assert.isNull(doc)
  })

  test('get a single doc by permalink', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await store.getDocByPermalink('guides', '1.0.0', '/hello')
    assert.deepEqual(doc, {
      title: 'Hello world',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })
  })

  test('attach version node to the doc node', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await store.getDocByPermalink('guides', '1.0.0', '/hello', true)
    assert.deepEqual(doc, {
      title: 'Hello world',
      permalink: '/hello',
      category: 'root',
      content: nodes,
      version: {
        no: '1.0.0',
        default: false,
        depreciated: false,
        draft: false,
        name: '1.0.0'
      }
    })
  })

  test('return null if doc is missing', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await store.getDocByPermalink('guides', '1.0.0', 'foo')
    assert.isNull(doc)
  })

  test('index docs for a given version', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const template = dedent`
    Hello world

    ## This is a section
    Some content here
    `

    const fooFile = await new Markdown(template).toJSON()

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: fooFile.contents
    })

    await store.saveDoc('guides', '1.0.1', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: fooFile.contents
    })

    await store.indexVersion('guides', '1.0.0')
    const indexFile = await fs.readJSON(join(domainDir, 'guides', '1.0.0', 'search.json'))

    assert.deepEqual(indexFile.docs, {
      '/hello#this-is-a-section': {
        title: 'This is a section',
        body: 'Some content here',
        url: '/hello#this-is-a-section'
      }
    })

    await store.indexVersion('guides', '1.0.1')
    const indexFile1 = await fs.readJSON(join(domainDir, 'guides', '1.0.1', 'search.json'))

    assert.deepEqual(indexFile1.docs, {
      '/hello#this-is-a-section': {
        title: 'This is a section',
        body: 'Some content here',
        url: '/hello#this-is-a-section'
      }
    })
  })

  test('search docs for a given term', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const template = dedent`
    Hello world

    ## Database
    Database content
    `

    const template1 = dedent`
    Hello world

    ## Routing
    Routing content
    `

    const fooFile = await new Markdown(template).toJSON()
    const fooFile1 = await new Markdown(template1).toJSON()

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: fooFile.contents
    })

    await store.saveDoc('guides', '1.0.1', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: fooFile1.contents
    })

    await store.indexVersion('guides', '1.0.0')
    await store.indexVersion('guides', '1.0.1')

    let dbSearch = await store.search('guides', '1.0.0', 'Database')
    let routingSearch = await store.search('guides', '1.0.0', 'Routing')

    assert.equal(dbSearch[0].ref, '/hello#database')
    assert.deepEqual(routingSearch, [])

    dbSearch = await store.search('guides', '1.0.1', 'Database')
    routingSearch = await store.search('guides', '1.0.1', 'Routing')

    assert.equal(routingSearch[0].ref, '/hello#routing')
    assert.deepEqual(dbSearch, [])
  })

  test('raise error when permalink is same', async (assert) => {
    assert.plan(2)

    const store = new Datastore(ctx)
    await store.db.load()

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello',
      permalink: '/hello',
      category: 'root',
      content: {
        type: 'root',
        children: [{}]
      }
    })

    try {
      await store.saveDoc('api', '1.0.0', 'bar.md', {
        title: 'Hello',
        permalink: '/hello',
        category: 'root',
        content: {
          type: 'root',
          children: [{}]
        }
      })
    } catch ({ message, ruleId }) {
      assert.equal(message, 'foo.md also using the same permalink: /hello')
      assert.equal(ruleId, 'duplicate-permalink')
    }
  })

  test('work fine when updating doc with same permalink', async (assert) => {
    assert.plan(2)

    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Updated Title',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, 'api', '1.0.0', 'foo.json'))

    assert.deepEqual(doc, nodes)
    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'api',
        name: 'api',
        versions: [
          {
            default: false,
            depreciated: false,
            draft: false,
            name: '1.0.0',
            no: '1.0.0',
            docs: [
              {
                jsonPath: 'foo.json',
                category: 'root',
                permalink: '/hello',
                title: 'Updated Title'
              }
            ]
          }
        ]
      }]
    })
  })

  test('work fine when updating doc with same permalink in different version', async (assert) => {
    assert.plan(2)

    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })

    await store.saveDoc('api', '1.0.1', 'bar.md', {
      title: 'Updated Title',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, 'api', '1.0.0', 'foo.json'))

    assert.deepEqual(doc, nodes)
    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'api',
        name: 'api',
        versions: [
          {
            default: false,
            depreciated: false,
            draft: false,
            name: '1.0.0',
            no: '1.0.0',
            docs: [
              {
                jsonPath: 'foo.json',
                category: 'root',
                permalink: '/hello',
                title: 'Hello'
              }
            ]
          },
          {
            default: false,
            depreciated: false,
            draft: false,
            name: '1.0.1',
            no: '1.0.1',
            docs: [
              {
                jsonPath: 'bar.json',
                category: 'root',
                permalink: '/hello',
                title: 'Updated Title'
              }
            ]
          }
        ]
      }]
    })
  })

  test('indexing version should start from scratch', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const template = dedent`
    Hello world

    ## Database
    Database content
    `

    const fooFile = await new Markdown(template).toJSON()

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: fooFile.contents
    })

    await store.indexVersion('guides', '1.0.0')

    await store.removeDoc('guides', '1.0.0', 'foo.md')
    await store.indexVersion('guides', '1.0.0')

    let search = await store.search('1.0.0', 'Database')
    assert.deepEqual(search, [])
  })

  test('get the permalink of the actual doc when redirected permalink is accessed', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const template = dedent`
    Hello world

    ## Database
    Database content
    `

    const fooFile = await new Markdown(template).toJSON()

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: fooFile.contents,
      redirects: ['/hel', '/helo']
    })

    const redirectTo = store.redirectedPermalink('api', '1.0.0', 'hel')
    assert.equal(redirectTo, '/hello')
  })

  test('return null for redirected permalink when doc has no redirects', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const template = dedent`
    Hello world

    ## Database
    Database content
    `

    const fooFile = await new Markdown(template).toJSON()

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: fooFile.contents
    })

    const redirectTo = store.redirectedPermalink('api', '1.0.0', 'hel')
    assert.isNull(redirectTo)
  })

  test('get a single doc by permalink by normalizing slashes', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('api', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await store.getDocByPermalink('api', '1.0.0', 'hello')
    assert.deepEqual(doc, {
      title: 'Hello world',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })
  })

  test('load store from a blank slate', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await store.saveDoc('guides', '1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await store.persist()
    let metaFile = await fs.exists(join(domainDir, 'meta.json'))
    let saveFile = await fs.exists(join(domainDir, 'guides', '1.0.0', 'foo.json'))

    assert.isTrue(metaFile)
    assert.isTrue(saveFile)

    await store.load(true)

    saveFile = await fs.exists(join(domainDir, 'guides', '1.0.0', 'foo.json'))
    assert.isFalse(saveFile)

    assert.deepEqual(store.db.data, { zones: [] })
  })

  test('save doc with nested baseName', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    await store.saveDoc('api', '1.0.0', 'foo/bar.md', {
      title: 'Hello',
      permalink: '/hello',
      category: 'root',
      content: {
        type: 'root',
        children: [{}]
      }
    })

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, 'api', '1.0.0', 'foo/bar.json'))

    assert.deepEqual(doc, { type: 'root', children: [{}] })
    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'api',
        name: 'api',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            draft: false,
            default: false,
            depreciated: false,
            docs: [
              {
                jsonPath: 'foo/bar.json',
                permalink: '/hello',
                title: 'Hello',
                category: 'root'
              }
            ]
          }
        ]
      }]
    })
  })

  test('save doc with nested baseName pull from windows path', async (assert) => {
    const store = new Datastore(ctx)
    await store.db.load()

    await store.saveDoc('api', '1.0.0', win32.join('foo', 'bar.md'), {
      title: 'Hello',
      permalink: '/hello',
      category: 'root',
      content: {
        type: 'root',
        children: [{}]
      }
    })

    await store.persist()

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, 'api', '1.0.0', 'foo/bar.json'))

    assert.deepEqual(doc, { type: 'root', children: [{}] })
    assert.deepEqual(metaFile, {
      zones: [{
        slug: 'api',
        name: 'api',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            draft: false,
            default: false,
            depreciated: false,
            docs: [
              {
                jsonPath: 'foo/bar.json',
                permalink: '/hello',
                title: 'Hello',
                category: 'root'
              }
            ]
          }
        ]
      }]
    })
  })
})
