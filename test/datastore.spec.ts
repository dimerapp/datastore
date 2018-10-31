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

import { Datastore } from '../src/Datastore'
import { Context } from '../src/Context'
import { getZone, getVersion, getBaseConfig } from '../test-helpers'

const BUILD_DIR = join(__dirname, 'build')

test.group('Datastore', (group) => {
  group.afterEach(async () => {
    await fs.remove(BUILD_DIR)
  })

  test('raise error if build path is missing in context', (assert) => {
    const db = () => new Datastore(new Context())
    assert.throw(db, 'Make sure to define the build path before instantiating datastore')
  })

  test('sync user config by saving config meta data', (assert) => {
    const ctx = new Context()
    ctx.addPath('build', BUILD_DIR)

    const db = new Datastore(ctx)
    db.syncConfig(getBaseConfig({ domain: 'foo.dimerapp.com' }))

    assert.deepEqual(db.metaData, {
      domain: 'foo.dimerapp.com',
      cname: undefined,
      theme: undefined,
      compilerOptions: {},
      themeOptions: {},
    })
  })

  test('return diff tree of versions from syncConfig call', (assert) => {
    const ctx = new Context()
    ctx.addPath('build', BUILD_DIR)

    const db = new Datastore(ctx)
    const diff = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0' })],
        }),
      ],
    }))

    assert.deepEqual(diff.removed, [])
    assert.deepEqual(diff.updated, [])
    assert.lengthOf(diff.added, 1)
    assert.equal(diff.added[0].uid, 'guides/1.0.0')
  })

  test('track removed versions', (assert) => {
    const ctx = new Context()
    ctx.addPath('build', BUILD_DIR)

    const db = new Datastore(ctx)
    const initialDiff = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0' })],
        }),
      ],
    }))

    const diff = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
    }))

    assert.deepEqual(diff.removed, [initialDiff.added[0]])
    assert.deepEqual(diff.updated, [])
    assert.deepEqual(diff.added, [])
  })

  test('track mix of removed, updated and added versions', (assert) => {
    const ctx = new Context()
    ctx.addPath('build', BUILD_DIR)

    const db = new Datastore(ctx)
    const addedv1 = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0' })],
        }),
      ],
    }))

    assert.deepEqual(addedv1.removed, [])
    assert.deepEqual(addedv1.updated, [])
    assert.lengthOf(addedv1.added, 1)
    assert.equal(addedv1.added[0].uid, 'guides/1.0.0')

    const updatedV1AndAddedV2 = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0' }), getVersion({ no: '2.0.0' })],
        }),
      ],
    }))

    assert.deepEqual(updatedV1AndAddedV2.removed, [])
    assert.lengthOf(updatedV1AndAddedV2.updated, 1)
    assert.equal(updatedV1AndAddedV2.updated[0].uid, 'guides/1.0.0')

    assert.lengthOf(updatedV1AndAddedV2.added, 1)
    assert.equal(updatedV1AndAddedV2.added[0].uid, 'guides/2.0.0')

    const keptMaster = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: 'master' })],
        }),
      ],
    }))

    assert.deepEqual(keptMaster.removed, updatedV1AndAddedV2.added.concat(addedv1.added))
    assert.deepEqual(keptMaster.updated, [])

    assert.lengthOf(keptMaster.added, 1)
    assert.equal(keptMaster.added[0].uid, 'guides/master')
  })

  test('update meta data of updated versions', (assert) => {
    const ctx = new Context()
    ctx.addPath('build', BUILD_DIR)

    const db = new Datastore(ctx)
    const addedv1 = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0' })],
        }),
      ],
    }))

    assert.deepEqual(addedv1.removed, [])
    assert.deepEqual(addedv1.updated, [])
    assert.lengthOf(addedv1.added, 1)
    assert.equal(addedv1.added[0].uid, 'guides/1.0.0')

    const updateV1 = db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0', name: 'Version 1' })],
        }),
      ],
    }))

    assert.deepEqual(updateV1.removed, [])
    assert.lengthOf(updateV1.updated, 1)
    assert.equal(updateV1.updated[0].name, 'Version 1')
  })

  test('get metadata json representation', (assert) => {
    const ctx = new Context()
    ctx.addPath('build', BUILD_DIR)

    const db = new Datastore(ctx)
    db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0' })],
        }),
      ],
    }))

    assert.deepEqual(db.toJSON(), {
      cname: undefined,
      domain: 'foo.dimerapp.com',
      compilerOptions: {},
      theme: undefined,
      themeOptions: {},
      zones: {
        guides: {
          name: 'guides',
          versions: [{ no: '1.0.0', name: '1.0.0', docs: {}, location: 'docs/master' }],
        },
      },
    })
  })

  test('write metadata json to meta.json file', async (assert) => {
    const ctx = new Context()
    ctx.addPath('build', BUILD_DIR)

    const db = new Datastore(ctx)
    db.syncConfig(getBaseConfig({
      domain: 'foo.dimerapp.com',
      zones: [
        getZone({
          versions: [getVersion({ no: '1.0.0' })],
        }),
      ],
    }))

    await db.commit()
    const contents = await fs.readJson(join(BUILD_DIR, 'api', 'meta.json'))

    assert.deepEqual(contents, {
      domain: 'foo.dimerapp.com',
      compilerOptions: {},
      themeOptions: {},
      zones: {
        guides: {
          name: 'guides',
          versions: [{ no: '1.0.0', name: '1.0.0', docs: {}, location: 'docs/master' }],
        },
      },
    })
  })
})
