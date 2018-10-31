/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join } from 'path'
import { readJson } from 'fs-extra'

import { IProjectConfig, IConfigError } from '../Contracts'
import { Context } from '../Context'
import { MissingAppRootPath, ConfigNotFound } from '../Exceptions'
import debug from '../../utils/debug'

/**
 * Config parser parses the `dimer.json` file and returns back an array of errors
 * (if any) and the parsed config.
 *
 * Config parser is very strict with the fields allowed within the config file and all
 * non-whitelisted data is trimmed off.
 *
 * For saving arbitary data, one should make use of `themeSettings` object and then
 * use it as required by fetching it from the API.
 */
export class ConfigParser {
  private _basePath: string = ''
  constructor (private _ctx: Context) {
    this._setBasePath()
  }

  /**
   * Sets the base path using the app root path from the context. Also
   * raises error if app root path is missing
   */
  private _setBasePath () {
    const buildPath = this._ctx.getPath('appRoot')

    if (!buildPath) {
      throw MissingAppRootPath.invoke()
    }

    this._basePath = buildPath
    debug('app root %s', this._basePath)
  }

  /**
   * Reads the config file and raises error when file is missing or has
   * syntax errors.
   */
  private async _readConfigFile () {
    try {
      return await readJson(join(this._ctx.getPath('appRoot')!, 'dimer.json'))
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw ConfigNotFound.invoke()
      }
      throw err
    }
  }

  /**
   * This method makes sure that versions or zones exists and they
   * don't exists together as top level nodes.
   */
  private _validateTopLevelKeys (config, errorsBag: IConfigError[]) {
    if (config.versions && config.zones) {
      errorsBag.push({
        message: 'Versions must be nested inside zones',
        ruleId: 'top-level-zones-and-versions',
      })
    }
  }

  /**
   * Returns a boolean telling if value is a valid object. It distinguishes
   * between `Arrays` and `null`.
   */
  private _isObject (value) {
    return value && !Array.isArray(value) && typeof (value) === 'object'
  }

  /**
   * Normalize a single zone by addressing different input values.
   *
   * 1. If `zone` is not defined, then an empty object is returned.
   * 2. If `zone` is a string, then it will used as the location of the `master` version.
   * 3. If `zone` is an object, then it's `name`, `slug`, and `versions` will be used.
   */
  private _normalizeZone (zone, slug) {
    if (!zone) {
      return {}
    }

    return typeof (zone) === 'string' ? {
      slug: slug,
      name: slug,
      versions: { master: zone },
    } : {
      slug: zone.slug || slug,
      name: zone.name || zone.slug || slug,
      versions: zone.versions || {},
    }
  }

  /**
   * Normalizes an array of zones from the config file
   */
  private _normalizeZones (config) {
    /**
     * Create the default zone when it's missing as top level node
     */
    if (!config.zones) {
      config.zones = {
        default: {
          versions: config.versions || {},
        },
      }
    }

    /**
     * If zones is not a valid object literal, then subsitute it with an
     * empty array
     */
    if (!this._isObject(config.zones)) {
      config.zones = []
      return
    }

    /**
     * Normalize zones and set it back as normalized array
     */
    config.zones = Object.keys(config.zones).map((slug) => {
      const zone = config.zones[slug]
      return this._normalizeZone(zone, slug)
    })
  }

  /**
   * Normalizes a single version by addressing different input types.
   *
   * 1. If `versionNode` is a string, then it will be used as the docs location.
   * 2. If `versionNode` is an object, then values will be read of the object
   * 3. Otherwise ignored and empty object is returned.
   */
  private _normalizeVersion (versionNo, versionNode) {
    if (typeof (versionNode) === 'string') {
      return {
        no: versionNo,
        location: versionNode,
        default: false,
        depreciated: false,
        draft: false,
      }
    }

    if (this._isObject(versionNode)) {
      return {
        draft: !!versionNode.draft,
        depreciated: !!versionNode.depreciated,
        location: versionNode.location,
        default: !!versionNode.default,
        no: versionNode.no || versionNo,
      }
    }

    return {}
  }

  /**
   * Normalizes all versions inside all the zones and mutates
   * them in place
   */
  private _normalizeVersions (config) {
    config.zones.forEach((zone) => {
      if (!zone.slug) {
        return
      }

      if (!this._isObject(zone.versions)) {
        zone.versions = []
        return
      }

      zone.versions = Object.keys(zone.versions).map((versionNo) => {
        return this._normalizeVersion(versionNo, zone.versions[versionNo])
      })
    })
  }

  /**
   * Validates all zones and their versions to make sure, we have
   * enough info to process docs.
   */
  private _validateZonesAndVersions (config, errorsBag) {
    let versionsCount = 0

    if (!config.zones.length) {
      errorsBag.push({
        message: 'Define atleast one version to process documentation',
        ruleId: 'missing-zones-and-versions',
      })
      return
    }

    config.zones.forEach((zone) => {
      if (!zone.slug) {
        errorsBag.push({
          message: 'Make sure to define slug for all zones',
          ruleId: 'missing-zone-slug',
        })
      }

      if (zone.versions) {
        versionsCount += zone.versions.length

        zone.versions.forEach((version) => {
          if (!version.no) {
            errorsBag.push({
              message: 'Each version must have a version number',
              ruleId: 'missing-version-no',
            })
          }

          if (!version.location) {
            errorsBag.push({
              message: 'Each version must specify the docs location',
              ruleId: 'missing-version-location',
            })
          }
        })
      }
    })

    if (versionsCount === 0) {
      errorsBag.push({
        message: 'Define atleast one version to process documentation',
        ruleId: 'missing-zones-and-versions',
      })
    }
  }

  /**
   * Parse the config file and return the normalized config object or an array
   * of errors (if any)
   */
  public async parse (): Promise<{ errors: IConfigError[], config: IProjectConfig }> {
    const errorsBag: IConfigError[] = []
    const config = await this._readConfigFile()

    /**
     * Validates the top level keys to make sure they are present
     * and not conflicting with each other
     */
    this._validateTopLevelKeys(config, errorsBag)

    /**
     * Normalize all the zones to be an array
     */
    this._normalizeZones(config)

    /**
     * Normalize all versions inside zones to be an array
     */
    this._normalizeVersions(config)

    /**
     * Validate normalized zones and versions
     */
    this._validateZonesAndVersions(config, errorsBag)

    return {
      errors: errorsBag,
      config: {
        domain: config.domain,
        cname: config.cname,
        theme: config.theme,
        zones: config.zones,
        compilerOptions: config.compilerOptions || {},
        themeOptions: config.themeOptions || {},
      },
    }
  }
}
