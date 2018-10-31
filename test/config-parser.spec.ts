/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import * as test from 'japa'

import { ConfigParser } from '../src/ConfigParser'
import { Context } from '../src/Context'
import fixtures from './fixtures'

test.group('Datastore', () => {
  fixtures.forEach((fixture) => {
    test(fixture.name, async (assert) => {
      const ctx = new Context()
      ctx.addPath('appRoot', fixture.appRoot)
      const parser = new ConfigParser(ctx)

      const { errors, config } = await parser.parse()
      assert.deepEqual(JSON.parse(JSON.stringify(errors)), fixture.errors)
      assert.deepEqual(JSON.parse(JSON.stringify(config)), fixture.output)
    })
  })
})
