/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join } from 'path'

const fixtures = [
  'empty-file',
  'no-zones',
  'top-level-versions',
  'top-level-versions-as-object',
  'versions-drop-extra-props',
  'version-as-null',
  'zone-as-string',
  'zone-as-null',
  'zones-drop-extra-props',
  'zone-define-name',
  'zone-as-array',
  'version-as-array',
  'one-zone-with-no-versions',
]

export default fixtures.map((fixture) => {
  return {
    name: fixture,
    appRoot: join(__dirname, fixture),
    errors: require(join(__dirname, fixture, 'errors.json')),
    output: require(join(__dirname, fixture, 'output.json')),
  }
})
