/*
* md-serve
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const fs = require('fs-extra')
const { join } = require('path')
const test = require('japa')
const MdServe = require('../src/MdServe')

const domainDir = join(__dirname, '..', 'sites', 'adonisjs.dimerapp.com')

test.group('MdServe', (group) => {
  group.afterEach(async () => {
    await fs.remove(domainDir)
  })

  test('raise error when versionNo or fileName is missing when saving doc', async (assert) => {
    assert.plan(1)

    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')

    try {
      await mdServe.saveDoc()
    } catch ({ message }) {
      assert.equal(message, 'Expected `versionNo` to be of type `string` but received type `undefined`')
    }
  })

  test('save markdown json and it\'s meta data to the disk', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello',
      permalink: '/hello',
      category: 'root',
      content: {
        type: 'root',
        children: [{}]
      }
    })

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, '1.0.0', 'foo.json'))

    assert.deepEqual(doc, { type: 'root', children: [{}] })
    assert.deepEqual(metaFile, {
      versions: [
        {
          no: '1.0.0',
          name: '1.0.0',
          draft: false,
          default: false,
          depreciated: false,
          docs: [
            {
              permalink: '/hello',
              title: 'Hello',
              category: 'root',
              jsonPath: 'foo.json'
            }
          ]
        }
      ]
    })
  })

  test('pull title from json when is not inside meta data', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [
        {
          t: 'elem',
          tag: 'dimerTitle',
          child: [{ t: 'text', value: 'Hello world' }]
        }
      ]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      permalink: '/hello',
      category: 'root',
      content: nodes
    })

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, '1.0.0', 'foo.json'))

    assert.deepEqual(doc, nodes)
    assert.deepEqual(metaFile, {
      versions: [
        {
          no: '1.0.0',
          name: '1.0.0',
          draft: false,
          default: false,
          depreciated: false,
          docs: [
            {
              permalink: '/hello',
              title: 'Hello world',
              category: 'root',
              jsonPath: 'foo.json'
            }
          ]
        }
      ]
    })
  })

  test('set category to root when is not inside meta data', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const doc = await fs.readJSON(join(domainDir, '1.0.0', 'foo.json'))

    assert.deepEqual(doc, nodes)
    assert.deepEqual(metaFile, {
      versions: [
        {
          no: '1.0.0',
          name: '1.0.0',
          draft: false,
          default: false,
          depreciated: false,
          docs: [
            {
              permalink: '/hello',
              title: 'Hello world',
              category: 'root',
              jsonPath: 'foo.json'
            }
          ]
        }
      ]
    })
  })

  test('sync versions', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    await mdServe.syncVersions([
      {
        no: '1.0.0'
      },
      {
        no: '1.0.1',
        default: true
      }
    ])

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(metaFile, {
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
    })
  })

  test('sync versions with existing content should work fine', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.syncVersions([
      {
        no: '1.0.0',
        name: 'Version 1'
      },
      {
        no: '1.0.1',
        default: true
      }
    ])

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(metaFile, {
      versions: [
        {
          no: '1.0.0',
          name: 'Version 1',
          default: false,
          depreciated: false,
          draft: false,
          docs: [
            {
              permalink: '/hello',
              category: 'root',
              title: 'Hello world',
              jsonPath: 'foo.json'
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
    })
  })

  test('sync versions should remove the one\'s not inside the array', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.saveDoc('1.0.1', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.syncVersions([
      {
        no: '1.0.0',
        name: 'Version 1'
      }
    ])

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(metaFile, {
      versions: [
        {
          no: '1.0.0',
          name: 'Version 1',
          default: false,
          depreciated: false,
          draft: false,
          docs: [
            {
              permalink: '/hello',
              category: 'root',
              title: 'Hello world',
              jsonPath: 'foo.json'
            }
          ]
        }
      ]
    })
  })

  test('sync versions should remove the content for one\'s not inside the array', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.saveDoc('1.0.1', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    let v1 = await fs.pathExists(join(domainDir, '1.0.0', 'foo.json'))
    let v2 = await fs.pathExists(join(domainDir, '1.0.1', 'foo.json'))
    assert.isTrue(v1)
    assert.isTrue(v2)

    await mdServe.syncVersions([
      {
        no: '1.0.0',
        name: 'Version 1'
      }
    ])

    v1 = await fs.pathExists(join(domainDir, '1.0.0', 'foo.json'))
    v2 = await fs.pathExists(join(domainDir, '1.0.1', 'foo.json'))
    assert.isTrue(v1)
    assert.isFalse(v2)

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    assert.deepEqual(metaFile, {
      versions: [
        {
          no: '1.0.0',
          name: 'Version 1',
          default: false,
          depreciated: false,
          draft: false,
          docs: [
            {
              permalink: '/hello',
              category: 'root',
              title: 'Hello world',
              jsonPath: 'foo.json'
            }
          ]
        }
      ]
    })
  })

  test('remove a given doc', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.removeDoc('1.0.0', 'foo.md')

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const foo = await fs.pathExists(join(domainDir, '1.0.0', 'foo.json'))
    assert.isFalse(foo)

    assert.deepEqual(metaFile, {
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
    })
  })

  test('skip when removing doc for a non-existing version', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.removeDoc('1.0.1', 'foo.md')

    const metaFile = await fs.readJSON(join(domainDir, 'meta.json'))
    const foo = await fs.pathExists(join(domainDir, '1.0.0', 'foo.json'))
    assert.isTrue(foo)

    assert.deepEqual(metaFile, {
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
    })
  })

  test('return an array of versions', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const versions = mdServe.getVersions()

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

  test('get docs for an array of version', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const docs = await mdServe.getDocs('1.0.0')
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            jsonPath: 'foo.json',
            title: 'Hello world',
            permalink: '/hello',
            category: 'root'
          }
        ]
      }
    ])
  })

  test('order versions by jsonPath', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.saveDoc('1.0.0', 'bar.md', {
      title: 'Hello world',
      permalink: '/bar',
      content: nodes
    })

    const docs = await mdServe.getDocs('1.0.0')
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            jsonPath: 'bar.json',
            title: 'Hello world',
            permalink: '/bar',
            category: 'root'
          },
          {
            jsonPath: 'foo.json',
            title: 'Hello world',
            permalink: '/hello',
            category: 'root'
          }
        ]
      }
    ])
  })

  test('load content for docs', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.saveDoc('1.0.0', 'bar.md', {
      title: 'Hello world',
      permalink: '/bar',
      content: nodes
    })

    const docs = await mdServe.getDocs('1.0.0', 0, true)
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            jsonPath: 'bar.json',
            title: 'Hello world',
            permalink: '/bar',
            category: 'root',
            content: nodes
          },
          {
            jsonPath: 'foo.json',
            title: 'Hello world',
            permalink: '/hello',
            category: 'root',
            content: nodes
          }
        ]
      }
    ])
  })

  test('limit docs', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    await mdServe.saveDoc('1.0.0', 'bar.md', {
      title: 'Hello world',
      permalink: '/bar',
      content: nodes
    })

    const docs = await mdServe.getDocs('1.0.0', 1, true)
    assert.deepEqual(docs, [
      {
        category: 'root',
        docs: [
          {
            jsonPath: 'bar.json',
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
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await mdServe.getDoc('1.0.0', 'foo.json')
    assert.deepEqual(doc, {
      jsonPath: 'foo.json',
      title: 'Hello world',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })
  })

  test('get a single doc by permalink', async (assert) => {
    const mdServe = new MdServe('adonisjs.dimerapp.com', 'http://localhost:3000')
    await mdServe.db.load()

    const nodes = {
      type: 'root',
      children: [{}]
    }

    await mdServe.saveDoc('1.0.0', 'foo.md', {
      title: 'Hello world',
      permalink: '/hello',
      content: nodes
    })

    const doc = await mdServe.getDocByPermalink('1.0.0', '/hello')
    assert.deepEqual(doc, {
      jsonPath: 'foo.json',
      title: 'Hello world',
      permalink: '/hello',
      category: 'root',
      content: nodes
    })
  })
})
