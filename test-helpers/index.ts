/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { IConfigZone, IConfigVersion, IProjectConfig, IDocNode } from '../src/Contracts'

export function getZone (zone): IConfigZone {
  return Object.assign({ slug: 'guides' }, zone)
}

export function getBaseConfig (config): IProjectConfig {
  return Object.assign({
    compilerOptions: {},
    themeOptions: {},
    zones: [],
  }, config)
}

export function getVersion (version): IConfigVersion {
  return Object.assign({
    no: 'master',
    default: false,
    depreciated: false,
    draft: false,
    location: 'docs/master',
  }, version)
}

export function getDoc (doc): IDocNode {
  return Object.assign({
    content: {
      type: 'root',
      children: [],
    },
    toc: true,
  }, doc)
}