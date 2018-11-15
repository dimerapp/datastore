/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import * as test from 'japa'
import { join, normalize } from 'path'
import * as fs from 'fs-extra'

import { Version } from '../src/Version'
import { Context } from '../src/Context'
import { getDoc } from '../test-helpers'

const BUILD_DIR = join(__dirname, 'build')

test.group('Version', (group) => {
  group.afterEach(async () => {
    await fs.remove(BUILD_DIR)
  })

  test('compute uid from no and zone', (assert) => {
    const ctx = new Context()

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    assert.equal(version.uid, 'master/1.0.0')
  })

  test('use version no as name when name is missing', (assert) => {
    const ctx = new Context()

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    assert.equal(version.name, '1.0.0')
  })

  test('raise error when saving doc without dest path', async (assert) => {
    assert.plan(2)

    const ctx = new Context()

    const doc = getDoc({
      permalink: 'foo',
      title: 'Hello foo',
    })

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })

    try {
      await version.saveDoc('foo.json', doc)
    } catch ({ message, ruleId }) {
      assert.equal(message, 'Cannot persist datastore without the dest path inside context')
      assert.equal(ruleId, 'internal-error')
    }
  })

  test('save doc content on the disk', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const doc = getDoc({
      permalink: 'foo',
      title: 'Hello foo',
    })

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.saveDoc('foo.md', doc)

    const contents = await fs.readJson(join(BUILD_DIR, 'api', 'master/1.0.0', 'foo.json'))
    assert.deepEqual(contents, doc.contents)
  })

  test('raise error when permalink is used by another doc', async (assert) => {
    assert.plan(2)

    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const doc = getDoc({
      permalink: 'foo',
      title: 'Hello foo',
    })

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.saveDoc('foo.md', doc)

    try {
      await version.saveDoc('foo1.md', Object.assign({}, doc))
    } catch ({ message, ruleId }) {
      assert.equal(message, `Duplicate permalink used by ${normalize('docs/master/foo.md')}`)
      assert.equal(ruleId, 'duplicate-permalink')
    }
  })

  test('work fine when updating the same doc', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const doc = getDoc({
      permalink: 'foo',
      title: 'Hello foo',
    })

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.saveDoc('foo.md', doc)
    await version.saveDoc('foo.md', Object.assign(doc, { title: 'Hi foo' }))

    assert.equal(version.docs[join(BUILD_DIR, 'api', 'master/1.0.0', 'foo.json')].title, 'Hi foo')
  })

  test('cleanup version base dir by removing it', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const doc = getDoc({
      permalink: 'foo',
      title: 'Hello foo',
    })

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.saveDoc('foo.md', doc)
    await version.clean()

    const exists = await fs.exists(join(BUILD_DIR, 'api', version.uid))

    assert.isTrue(version.isFrozen, 'Expected verion to be frozen')
    assert.isFalse(exists, 'Expected base dir to not exist')
  })

  test('remove doc from the disk', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const doc = getDoc({
      permalink: 'foo',
      title: 'Hello foo',
    })

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.saveDoc('foo.md', doc)
    await version.removeDoc('foo.md')

    const exists = await fs.exists(join(BUILD_DIR, 'api', version.uid))
    const existsDoc = await fs.exists(join(BUILD_DIR, 'api', version.uid, 'foo.json'))

    assert.isTrue(exists)
    assert.isFalse(existsDoc)
  })

  test('update version name', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    version.update({ name: 'Version master' })

    assert.equal(version.name, 'Version master')
  })

  test('update version docs location', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    version.update({ location: 'docs/foo' })

    assert.equal(version.docsPath, 'docs/foo')
  })

  test('raise error if version is frozen and trying to update it', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.clean()

    const fn = () => version.update({ location: 'docs/foo' })
    assert.throw(fn, 'Cannot modify deleted version')
  })

  test('raise error if version is frozen and trying to saveDoc it', async (assert) => {
    assert.plan(2)

    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.clean()

    try {
      await version.saveDoc('foo.md', getDoc({
        permalink: 'foo',
        title: 'Hello foo',
      }))
    } catch ({ message, ruleId }) {
      assert.equal(message, 'Cannot modify deleted version')
      assert.equal(ruleId, 'internal-error')
    }
  })

  test('raise error if version is frozen and trying to remove doc', async (assert) => {
    assert.plan(2)

    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.clean()

    try {
      await version.removeDoc('foo.md')
    } catch ({ message, ruleId }) {
      assert.equal(message, 'Cannot modify deleted version')
      assert.equal(ruleId, 'internal-error')
    }
  })

  test('get version json structure', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })

    assert.deepEqual(version.toJSON(), {
      no: '1.0.0',
      location: 'docs/master',
      name: '1.0.0',
      docs: {},
    })
  })

  test('get version json structure with a doc', async (assert) => {
    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.saveDoc('foo.md', getDoc({ permalink: 'foo', title: 'Hello foo' }))

    assert.deepEqual(version.toJSON(), {
      no: '1.0.0',
      location: 'docs/master',
      name: '1.0.0',
      docs: {
        [join(BUILD_DIR, 'api', version.uid, 'foo.json')]: {
          srcPath: 'foo.md',
          permalink: 'foo',
          title: 'Hello foo',
          toc: true,
        },
      },
    })
  })

  test('raise error when source files are same with different markdown extension', async (assert) => {
    assert.plan(2)

    const ctx = new Context()
    ctx.addPath('dest', join(BUILD_DIR, 'api'))

    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'master' })
    await version.saveDoc('foo.md', getDoc({ permalink: 'foo', title: 'Hello foo' }))

    try {
      await version.saveDoc('foo.mkd', getDoc({ permalink: 'bar', title: 'Hello bar' }))
    } catch ({ message, ruleId }) {
      assert.equal(
        message,
        `${normalize('docs/master/foo.mkd')} and ${normalize('docs/master/foo.md')} are potentially same`,
      )
      assert.equal(ruleId, 'duplicate-src-path')
    }
  })
})
