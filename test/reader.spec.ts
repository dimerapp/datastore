/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import * as test from 'japa'
import { join } from 'path'
import * as fs from 'fs-extra'

import { Reader } from '../src/Reader'
import { Context } from '../src/Context'
import { Version } from '../src/Version'

const APP_ROOT = join(__dirname, 'app')

test.group('Reader', (group) => {
  group.afterEach(async () => {
    await fs.remove(APP_ROOT)
  })

  test('raise error when appRoot is missing', (assert) => {
    const ctx = new Context()
    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'guides' })

    const fn = () => new Reader(ctx, version)
    assert.throw(fn, 'Make sure to define the appRoot path before instantiating the reader')
  })

  test('raise error when version directory is missing', async (assert) => {
    assert.plan(2)

    const ctx = new Context()
    ctx.addPath('appRoot', APP_ROOT)
    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'guides' })

    const reader = new Reader(ctx, version)
    try {
      await reader.getTree()
    } catch ({ message, ruleId }) {
      assert.equal(message, 'Unable to find directory docs/master referenced by 1.0.0')
      assert.equal(ruleId, 'missing-version-location')
    }
  })

  test('return an empty array when there are no markdown files in the version dir', async (assert) => {
    await fs.ensureDir(join(APP_ROOT, 'docs/master'))

    const ctx = new Context()
    ctx.addPath('appRoot', APP_ROOT)
    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'guides' })

    const reader = new Reader(ctx, version)
    const tree = await reader.getTree()

    assert.deepEqual(tree, [])
  })

  test('return an array of markdown files', async (assert) => {
    await fs.ensureFile(join(APP_ROOT, 'docs/master/intro.md'))
    await fs.ensureFile(join(APP_ROOT, 'docs/master/installation.mkdown'))

    const ctx = new Context()
    ctx.addPath('appRoot', APP_ROOT)
    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'guides' })

    const reader = new Reader(ctx, version)
    const tree = await reader.getTree()

    assert.deepEqual(tree, [
      {
        absPath: join(APP_ROOT, 'docs/master/installation.mkdown'),
        relativePath: 'installation.mkdown',
      },
      {
        absPath: join(APP_ROOT, 'docs/master/intro.md'),
        relativePath: 'intro.md',
      },
    ])
  })

  test('skip non markdown files', async (assert) => {
    await fs.ensureFile(join(APP_ROOT, 'docs/master/intro.md'))
    await fs.ensureFile(join(APP_ROOT, 'docs/master/installation.txt'))

    const ctx = new Context()
    ctx.addPath('appRoot', APP_ROOT)
    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'guides' })

    const reader = new Reader(ctx, version)
    const tree = await reader.getTree()

    assert.deepEqual(tree, [
      {
        absPath: join(APP_ROOT, 'docs/master/intro.md'),
        relativePath: 'intro.md',
      },
    ])
  })

  test('skip files starting with _ known as draft', async (assert) => {
    await fs.ensureFile(join(APP_ROOT, 'docs/master/intro.md'))
    await fs.ensureFile(join(APP_ROOT, 'docs/master/_installation.mkdown'))

    const ctx = new Context()
    ctx.addPath('appRoot', APP_ROOT)
    const version = new Version('1.0.0', 'docs/master', ctx, { slug: 'guides' })

    const reader = new Reader(ctx, version)
    const tree = await reader.getTree()

    assert.deepEqual(tree, [
      {
        absPath: join(APP_ROOT, 'docs/master/intro.md'),
        relativePath: 'intro.md',
      },
    ])
  })
})
