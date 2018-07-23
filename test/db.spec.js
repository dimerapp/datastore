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

  test('save version to the disk', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion({ no: '1.0.0' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      versions: [{
        no: '1.0.0',
        name: '1.0.0',
        default: false,
        draft: false,
        depreciated: false,
        docs: []
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('update version when already exists', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion({ no: '1.0.0' })
    db.saveVersion({ no: '1.0.0', name: 'Version 1' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
      versions: [{
        no: '1.0.0',
        name: 'Version 1',
        default: false,
        draft: false,
        depreciated: false,
        docs: []
      }]
    })

    assert.isTrue(db.isFileValid())
  })

  test('add doc for a given version', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.addDoc('1.0.0', {
      permalink: 'foo',
      jsonPath: 'foo.json',
      title: 'Hello foo',
      category: 'root'
    })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
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
    })

    assert.isTrue(db.isFileValid())
  })

  test('add doc for existing version', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion({ no: '1.0.0', name: 'Version 1' })
    db.addDoc('1.0.0', {
      permalink: 'foo',
      jsonPath: 'foo.json',
      title: 'Hello foo',
      category: 'root'
    })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
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
    })

    assert.isTrue(db.isFileValid())
  })

  test('update doc when already exists', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    db.saveVersion({ no: '1.0.0', name: 'Version 1' })

    db.addDoc('1.0.0', {
      permalink: 'foo',
      jsonPath: 'foo.json',
      title: 'Hello foo',
      category: 'root'
    })

    db.addDoc('1.0.0', {
      permalink: 'bar',
      jsonPath: 'foo.json',
      title: 'Hi foo',
      category: 'root'
    })

    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, {
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
    })

    assert.isTrue(db.isFileValid())
  })

  test('return an empty array of versions', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    assert.deepEqual(db.getVersions(), [])
    assert.isTrue(db.isFileValid())
  })

  test('return an array of saved versions', async (assert) => {
    const db = new Db(dbFile)
    await db.load()

    const version = await db.saveVersion({ no: '1.2' })
    assert.deepEqual(db.getVersions(), [_.omit(version, ['docs'])])

    assert.isTrue(db.isFileValid())
  })

  test('load existing file from disk', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      versions: [
        {
          no: '1.0.0'
        }
      ]
    })

    await db.load()
    assert.deepEqual(db.getVersions(), [{
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
      versions: [
        {
          no: '1.0.0'
        }
      ]
    })

    await db.load()
    db.removeVersion('1.0.0', true)
    assert.deepEqual(db.getVersions(), [])
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, { versions: [] })

    assert.isTrue(db.isFileValid())
  })

  test('do not remove other versions', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
      versions: [
        {
          no: '1.0.0'
        },
        {
          no: '1.0.1'
        }
      ]
    })

    await db.load()
    db.removeVersion('1.0.0', true)
    assert.deepEqual(db.getVersions(), [{
      default: false,
      draft: false,
      depreciated: false,
      no: '1.0.1',
      name: '1.0.1'
    }])

    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, { versions: [{
      default: false,
      draft: false,
      depreciated: false,
      no: '1.0.1',
      name: '1.0.1',
      docs: []
    }] })

    assert.isTrue(db.isFileValid())
  })

  test('remove doc for a given version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()
    db.removeDoc('1.0.0', 'foo.json')
    await db.persist()

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, { versions: [{
      default: false,
      draft: false,
      depreciated: false,
      no: '1.0.0',
      name: '1.0.0',
      docs: []
    }] })

    assert.isTrue(db.isFileValid())
  })

  test('skip when version doesn\'t exists', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()
    await db.removeDoc('1.0.1', 'foo')

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, { versions: [{
      no: '1.0.0',
      name: '1.0.0',
      docs: [{ permalink: 'foo', jsonPath: 'foo.json', category: 'root', title: 'Foo' }]
    }] })

    assert.isTrue(db.isFileValid())
  })

  test('skip when doc doesn\'t exists', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()
    await db.removeDoc('1.0.0', 'bar')

    const contents = await fs.readJSON(dbFile)
    assert.deepEqual(contents, { versions: [{
      no: '1.0.0',
      docs: [{ permalink: 'foo' }]
    }] })
  })

  test('get a specific version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()

    assert.deepEqual(db.getVersion('1.0.0'), {
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

  test('return undefined when version is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()

    assert.isUndefined(db.getVersion('1.0.1'))
  })

  test('return a specific doc', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()

    assert.deepEqual(db.getDocByPermalink('1.0.0', 'foo'), {
      permalink: 'foo',
      title: 'Foo',
      jsonPath: 'foo.json',
      category: 'root'
    })

    assert.isTrue(db.isFileValid())
  })

  test('return undefined when version is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()
    assert.isUndefined(db.getDocByPermalink('1.0.1', 'foo'))
  })

  test('return undefined when doc is missing', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {
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
    })

    await db.load()
    assert.isUndefined(db.getDocByPermalink('1.0.0', 'bar'))
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
    await db.saveVersion({ no: '1.0.0' })
    assert.isTrue(db.isFileValid())
  })

  test('return true from isFileValid when a doc is saved', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion({ no: '1.0.0' })
    await db.addDoc('1.0.0', { title: 'Hello', permalink: 'foo', category: 'root', jsonPath: 'foo.json' })
    assert.isTrue(db.isFileValid())
  })

  test('return false from isFileValid when {no} is missing from version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion({ no: '1.0.0' })
    delete db.data.versions[0].no
    assert.isFalse(db.isFileValid())
  })

  test('return false from isFileValid when docs property is missing from version', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion({ no: '1.0.0' })
    delete db.data.versions[0].docs
    assert.isFalse(db.isFileValid())
  })

  test('return false from isFileValid when permalink property is missing from doc', async (assert) => {
    const db = new Db(dbFile, { autoload: false })
    await fs.outputJSON(dbFile, {})

    await db.load()
    await db.saveVersion({ no: '1.0.0' })
    await db.addDoc('1.0.0', { title: 'Hello', permalink: 'foo', category: 'root', jsonPath: 'foo.json' })
    delete db.data.versions[0].docs[0].permalink

    assert.isFalse(db.isFileValid())
  })

  test('save website meta data', async (assert) => {
    const db = new Db(dbFile, { autoload: false })

    await db.load()
    db.syncMetaData({ domain: 'foo' })
    await db.persist()

    const contents = await fs.readJSON(dbFile)

    assert.deepEqual(contents, { domain: 'foo', versions: [] })
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
      versions: [
        {
          no: '1.0'
        }
      ]
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
      versions: [{ no: '1.0', default: false, depreciated: false, draft: false, name: '1.0', docs: [] }]
    })
  })
})
