/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join } from 'path'
import * as steno from 'steno'
import { ensureDir } from 'fs-extra'

import { Context } from '../Context'
import { IProjectConfig, IConfigZone } from '../Contracts'
import { Version } from '../Version'

type ISyncDiff = {
  added: Version[],
  removed: Version[],
  updated: Version[],
}

/**
 * Datastore manages the lifecycle of documentation by keeping the user `dimer.json`
 * config file in sync.
 *
 * Also it tracks the versions and updates the meta data, which can be used to get an
 * overview of `zones`, `versions` and `docs` in the system.
 */
export class Datastore {
  private _basePath: string = ''
  private _trackedVersions: Version[] = []

  public metaData: Partial<IProjectConfig> = {}

  constructor (private _ctx: Context) {
    this._setBasePath()

    /**
     * Add dest path to the context for other parts of the APP
     * to reference it
     */
    this._ctx.addPath('dest', join(this._basePath, 'api'))

    /**
     * Add meta.json path to the context for others parts to of the APP
     * to reference it
     */
    this._ctx.addPath('meta.json', join(this._basePath, 'api', 'meta.json'))
  }

  /**
   * Sets the base path using the build path from the context. Also
   * raises error if build path is missing
   */
  private _setBasePath () {
    const buildPath = this._ctx.getPath('build')

    if (!buildPath) {
      const error = new Error('Make sure to define the build path before instantiating datastore')
      error['ruleId'] = 'internal-error'
      throw error
    }

    this._basePath = buildPath
  }

  /**
   * Update the project meta data. We cherry pick the top level fields. However,
   * `themeOptions` and `compilerOptions` can contain arbitary json.
   */
  private _setMetaData (config: IProjectConfig) {
    this.metaData = {
      domain: config.domain,
      cname: config.cname,
      theme: config.theme,
      themeOptions: config.themeOptions,
      compilerOptions: config.compilerOptions,
    }
  }

  /**
   * Returns the diff of versions which have been removed, updated
   * or added as per the new config.
   *
   * The removed versions are not tracked anymore by the datastore and
   * it is advised to call `cleanup` on each removed version to
   * remove the files from disk.
   */
  private _getSyncDiff (zones: IConfigZone[]): ISyncDiff {
    const added: Version[] = []
    const removed: Version[] = []
    const updated: Version[] = []
    const retainedUid: string[] = []

    /**
     * The following code is bit verbose, but its pretty performant and clear
     * in terms of the operations we are performing.
     */
    zones.forEach((zone) => {
      zone.versions.forEach((version) => {
        const versionInstance = new Version(version.no, version.location, this._ctx, zone.slug, version.name)
        const existingVersion = this._trackedVersions.find((version) => version.uid === versionInstance.uid)
        if (existingVersion) {
          existingVersion.update(version)
          retainedUid.push(existingVersion.uid)
          updated.push(existingVersion)
        } else {
          retainedUid.push(versionInstance.uid)
          added.push(versionInstance)
        }
      })
    })

    this._trackedVersions.forEach((version) => {
      if (retainedUid.indexOf(version.uid) === -1) {
        removed.push(version)
      }
    })

    return { added, removed, updated }
  }

  /**
   * Sync the user config file and make neccessary adjustments to the datastore. This
   * method returns a diff of versions, which have been `removed`, `added` or
   * `updated` since the last sync.
   */
  public syncConfig (config: IProjectConfig): ISyncDiff {
    this._setMetaData(config)

    const diff = this._getSyncDiff(config.zones)

    /**
     * Update the tracked versions by concatinating added and updated
     * versions
     */
    this._trackedVersions = diff.added.concat(diff.updated)

    return diff
  }

  /**
   * Commit the changes and write them to the disk.
   */
  public commit () {
    return new Promise((resolve, reject) => {
      ensureDir(this._ctx.getPath('dest'))
      .then(() => {
        steno.writeFile(this._ctx.getPath('meta.json'), JSON.stringify(this.toJSON()), (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
       })
      .catch(reject)
    })
  }

  /**
   * Returns the JSON representation of the datastore meta.json file.
   */
  public toJSON (): any {
    const zones = {}

    this._trackedVersions.forEach((version) => {
      zones[version.zone] = zones[version.zone] || { name: version.zone, versions: [] }
      zones[version.zone].versions.push(version.toJSON())
    })

    return Object.assign({}, this.metaData, { zones })
  }
}
