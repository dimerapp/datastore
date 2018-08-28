/*
* md-serve
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const test = require('japa')
const { join } = require('path')
const fs = require('fs-extra')
const _ = require('lodash')

const Db = require('../src/Db')

const dbFile = join(__dirname, 'db.json')

test.group('Db', (group) => {
  group.afterEach(async () => {
    await fs.remove(dbFile)
  })

  test('raise error when db is not loaded', async (assert) => {
    const db = new Db(dbFile, { autoload: false })

    const fns = Object
      .getOwnPropertyNames(Db.prototype)
      .filter((fn) => {
        return !fn.startsWith('_') && ['constructor', 'isFileValid', 'load', 'persist'].indexOf(fn) === -1
      })

    for (let fn of fns) {
      assert.throw(db[fn].bind(db), 'Wait for the db to be ready. Move your code inside the onReady callback')
    }
  })

  test('save version to the disk', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion('default', { no: '1.0.0' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      zones: [{
        name: 'default',
        slug: 'default',
        versions: [{
          no: '1.0.0',
          name: '1.0.0',
          default: false,
          draft: false,
          depreciated: false,
          docs: []
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('update version when already exists', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion('guides', { no: '1.0.0' })
    db.saveVersion('guides', { no: '1.0.0', name: 'Version 1' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      zones: [
        {
          slug: 'guides',
          name: 'guides',
          versions: [{
            no: '1.0.0',
            name: 'Version 1',
            default: false,
            draft: false,
            depreciated: false,
            docs: []
          }]
        }
      ]
    })

    assert.isTrue(db.isFileValid())
  })

  test('add doc for a given version', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.addDoc('guides', '1.0.0', {
      permalink: 'foo',
      jsonPath: 'foo.json',
      title: 'Hello foo',
      category: 'root'
    })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [{
          no: '1.0.0',
          name: '1.0.0',
          default: false,
          draft: false,
          depreciated: false,
          docs: [
            {
              permalink: 'foo',
              jsonPath: 'foo.json',
              title: 'Hello foo',
              category: 'root'
            }
          ]
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('add doc for existing version', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion('guides', { no: '1.0.0', name: 'Version 1' })
    db.addDoc('guides', '1.0.0', {
      permalink: 'foo',
      jsonPath: 'foo.json',
      title: 'Hello foo',
      category: 'root'
    })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [{
          no: '1.0.0',
          name: 'Version 1',
          default: false,
          draft: false,
          depreciated: false,
          docs: [
            {
              permalink: 'foo',
              jsonPath: 'foo.json',
              title: 'Hello foo',
              category: 'root'
            }
          ]
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('update doc when already exists', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion('guides', { no: '1.0.0', name: 'Version 1' })

    db.addDoc('guides', '1.0.0', {
      permalink: 'foo',
      jsonPath: 'foo.json',
      title: 'Hello foo',
      category: 'root'
    })

    db.addDoc('guides', '1.0.0', {
      permalink: 'bar',
      jsonPath: 'foo.json',
      title: 'Hi foo',
      category: 'root'
    })

    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [{
          no: '1.0.0',
          name: 'Version 1',
          default: false,
          draft: false,
          depreciated: false,
          docs: [
            {
              permalink: 'bar',
              jsonPath: 'foo.json',
              title: 'Hi foo',
              category: 'root'
            }
          ]
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('return null for versions when zone doesn\'t exists', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    assert.isNull(db.getVersions('guides'))
    assert.isTrue(db.isFileValid())
  })

  test('return an empty array of versions', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveZone({ slug: 'guides' })
    assert.deepEqual(db.getVersions('guides'), [])
    assert.isTrue(db.isFileValid())
  })

  test('return an array of saved versions', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    const version = await db.saveVersion('guides', { no: '1.2' })
    assert.deepEqual(db.getVersions('guides'), [_.omit(version, ['docs'])])

    assert.isTrue(db.isFileValid())
  })

  test('load existing file from disk', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        versions: [{
          no: '1.0.0'
        }]
      }]
    })

    await db.load()
    assert.deepEqual(db.getVersions('guides'), [{
      default: false,
      draft: false,
      depreciated: false,
      no: '1.0.0',
      name: '1.0.0'
    }])

    assert.isTrue(db.isFileValid())
  })

  test('remove version and it\'s docs', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        versions: [{
          no: '1.0.0'
        }]
      }]
    })

    await db.load()
    db.removeVersion('guides', '1.0.0')
    assert.deepEqual(db.getVersions('guides'), [])
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{ slug: 'guides', name: 'guides', versions: [] }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('do not remove other versions', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0'
          },
          {
            no: '1.0.1'
          }
        ]
      }]
    })

    await db.load()
    db.removeVersion('guides', '1.0.0')
    assert.deepEqual(db.getVersions('guides'), [{
      default: false,
      draft: false,
      depreciated: false,
      no: '1.0.1',
      name: '1.0.1'
    }])

    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [{
          default: false,
          draft: false,
          depreciated: false,
          no: '1.0.1',
          name: '1.0.1',
          docs: []
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('remove doc for a given version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo',
                jsonPath: 'foo.json'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    db.removeDoc('guides', '1.0.0', 'foo.json')
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [{
          default: false,
          draft: false,
          depreciated: false,
          no: '1.0.0',
          name: '1.0.0',
          docs: []
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('skip when version doesn\'t exists', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            name: '1.0.0',
            docs: [
              {
                permalink: 'foo',
                jsonPath: 'foo.json',
                category: 'root',
                title: 'Foo'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    await db.removeDoc('guides', '1.0.1', 'foo')

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [{
          no: '1.0.0',
          name: '1.0.0',
          docs: [{ permalink: 'foo', jsonPath: 'foo.json', category: 'root', title: 'Foo' }]
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('skip when doc doesn\'t exists', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    db.removeDoc('guides', '1.0.0', 'bar')
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [{
          no: '1.0.0',
          name: '1.0.0',
          default: false,
          depreciated: false,
          draft: false,
          docs: [{ permalink: 'foo' }]
        }]
      }]
    })
  })

  test('get a specific version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo',
                title: 'Foo',
                jsonPath: 'foo.json',
                category: 'root'
              }
            ]
          }
        ]
      }]
    })

    await db.load()

    assert.deepEqual(db.getVersion('guides', '1.0.0'), {
      default: false,
      draft: false,
      depreciated: false,
      no: '1.0.0',
      name: '1.0.0',
      docs: [
        {
          permalink: 'foo',
          title: 'Foo',
          jsonPath: 'foo.json',
          category: 'root'
        }
      ]
    })

    assert.isTrue(db.isFileValid())
  })

  test('return null when version is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    assert.isNull(db.getVersion('guides', '1.0.1'))
  })

  test('return null when zone is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    assert.isNull(db.getVersion('foo', '1.0.1'))
  })

  test('return a specific doc', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo',
                title: 'Foo',
                jsonPath: 'foo.json',
                category: 'root'
              }
            ]
          }
        ]
      }]
    })

    await db.load()

    assert.deepEqual(db.getDocByPermalink('guides', '1.0.0', 'foo'), {
      permalink: 'foo',
      title: 'Foo',
      jsonPath: 'foo.json',
      category: 'root'
    })

    assert.isTrue(db.isFileValid())
  })

  test('return null when version is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    assert.isNull(db.getDocByPermalink('guides', '1.0.1', 'foo'))
  })

  test('return null when doc is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    assert.isNull(db.getDocByPermalink('guides', '1.0.0', 'bar'))
  })

  test('return true from isFileValid when there are no versions', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      versions: []
    })

    await db.load()
    assert.isTrue(db.isFileValid())
  })

  test('return true from isFileValid when file is empty', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    assert.isTrue(db.isFileValid())
  })

  test('return true from isFileValid when a version is saved', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion('guides', { no: '1.0.0' })
    assert.isTrue(db.isFileValid())
  })

  test('return true from isFileValid when a doc is saved', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion('guides', { no: '1.0.0' })
    await db.addDoc('guides', '1.0.0', { title: 'Hello', permalink: 'foo', category: 'root', jsonPath: 'foo.json' })
    assert.isTrue(db.isFileValid())
  })

  test('return false from isFileValid when {no} is missing from version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion('guides', { no: '1.0.0' })
    delete db.data.zones[0].versions[0].no
    assert.isFalse(db.isFileValid())
  })

  test('return false from isFileValid when docs property is missing from version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion('guides', { no: '1.0.0' })
    delete db.data.zones[0].versions[0].docs
    assert.isFalse(db.isFileValid())
  })

  test('return false from isFileValid when permalink property is missing from doc', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion('guides', { no: '1.0.0' })
    await db.addDoc('guides', '1.0.0', { title: 'Hello', permalink: 'foo', category: 'root', jsonPath: 'foo.json' })
    delete db.data.zones[0].versions[0].docs[0].permalink

    assert.isFalse(db.isFileValid())
  })

  test('save website meta data', async (assert) => {
    const db = new Db(dbFile, { autoload: false })

    await db.load()
    db.syncMetaData({ domain: 'foo' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, { domain: 'foo', zones: [] })
  })

  test('remove properties which are not part of new meta data', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      themeSettings: {
        headerBg: 'white',
        emojis: {
          smile: ':smile:',
          joy: ':joy:'
        }
      },
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [{ no: '1.0' }]
      }]
    })

    await db.load()
    db.syncMetaData({
      domain: 'foo',
      themeSettings: {
        emojis: {
          smile: ':smile:'
        }
      }
    })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      domain: 'foo',
      themeSettings: {
        emojis: {
          smile: ':smile:'
        }
      },
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [{
          no: '1.0',
          default: false,
          depreciated: false,
          draft: false,
          name: '1.0',
          docs: []
        }]
      }]
    })
  })

  test('save zone to the disk', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveZone({ slug: 'default', versions: [] })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      zones: [{
        slug: 'default',
        name: 'default',
        versions: []
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('update zone when already exists', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveZone({ slug: 'default' })
    await db.persist()

    db.saveZone({ slug: 'default', name: 'The default' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        slug: 'default',
        name: 'The default',
        versions: []
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('add version for a given zone', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion('default', { no: '1.0.0' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        slug: 'default',
        name: 'default',
        versions: [{
          no: '1.0.0',
          name: '1.0.0',
          default: false,
          depreciated: false,
          docs: [],
          draft: false
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('add version for existing zone', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveZone({ slug: 'guides' })
    db.saveVersion('guides', { no: '1.0.0' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [{
          no: '1.0.0',
          name: '1.0.0',
          default: false,
          depreciated: false,
          docs: [],
          draft: false
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('return null when doc is missing using getDoc function', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    assert.isNull(db.getDoc('guides', '1.0.0', 'bar'))
  })

  test('return doc when it exists using getDoc function', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        name: 'guides',
        slug: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo',
                jsonPath: 'foo.json'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    assert.deepEqual(db.getDoc('guides', '1.0.0', 'foo.json'), {
      permalink: 'foo',
      jsonPath: 'foo.json'
    })
  })

  test('return null from getDoc when version is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [
          {
            no: '1.0.0',
            docs: [
              {
                permalink: 'foo',
                jsonPath: 'foo.json'
              }
            ]
          }
        ]
      }]
    })

    await db.load()
    assert.isNull(db.getDoc('guides', '1.0.1', 'foo.json'))
  })

  test('removing version for non-existing zone should be noop', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        versions: [{
          no: '1.0.0'
        }]
      }]
    })

    await db.load()
    db.removeVersion('faq', '1.0.0')
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: [{
        slug: 'guides',
        name: 'guides',
        versions: [{
          no: '1.0.0',
          name: '1.0.0',
          default: false,
          depreciated: false,
          draft: false,
          docs: []
        }]
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('return doc when its for the same version and has same permalink', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await db.load()

    db.addDoc('guides', '1.0.0', {
      jsonPath: 'foo.json',
      category: 'root',
      permalink: 'foo',
      title: 'Foo'
    })

    assert.deepEqual(db.findDuplicateDoc('guides', '1.0.0', 'foo', 'bar.json'), {
      jsonPath: 'foo.json',
      category: 'root',
      permalink: 'foo',
      title: 'Foo'
    })
  })

  test('return null from findDuplicateDoc when jsonPath is same', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await db.load()

    db.addDoc('guides', '1.0.0', {
      jsonPath: 'foo.json',
      category: 'root',
      permalink: 'foo',
      title: 'Foo'
    })

    assert.isNull(db.findDuplicateDoc('guides', '1.0.0', 'foo', 'foo.json'))
  })

  test('return null from findDuplicateDoc when permalink is different', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await db.load()

    db.addDoc('guides', '1.0.0', {
      jsonPath: 'foo.json',
      category: 'root',
      permalink: 'foo',
      title: 'Foo'
    })

    assert.isNull(db.findDuplicateDoc('guides', '1.0.0', 'bar', 'bar.json'))
  })

  test('return null from findDuplicateDoc when version is different', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await db.load()

    db.addDoc('guides', '1.0.0', {
      jsonPath: 'foo.json',
      category: 'root',
      permalink: 'foo',
      title: 'Foo'
    })

    assert.isNull(db.findDuplicateDoc('guides', '1.0.1', 'foo', 'bar.json'))
  })

  test('return null from findDuplicateDoc when zone is different', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await db.load()

    db.addDoc('guides', '1.0.0', {
      jsonPath: 'foo.json',
      category: 'root',
      permalink: 'foo',
      title: 'Foo'
    })

    assert.isNull(db.findDuplicateDoc('faq', '1.0.0', 'foo', 'bar.json'))
  })

  test('return null from findDuplicateDoc when zone is different', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await db.load()

    db.addDoc('guides', '1.0.0', {
      jsonPath: 'foo.json',
      category: 'root',
      permalink: 'foo',
      title: 'Foo'
    })

    assert.isNull(db.findDuplicateDoc('faq', '1.0.0', 'foo', 'bar.json'))
  })

  test('remove zone and it\'s versions', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      zones: [{
        slug: 'guides',
        versions: [{
          no: '1.0.0'
        }]
      }]
    })

    await db.load()

    db.removeZone('guides')
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, {
      zones: []
    })

    assert.isTrue(db.isFileValid())
  })
})
