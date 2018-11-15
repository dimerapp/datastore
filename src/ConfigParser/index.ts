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

import { IProjectConfig, IConfigError, IConfigZone, IConfigVersion } from '../Contracts'
import { Context } from '../Context'
import { MissingPath, FileNotFound } from '../Exceptions'
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
  private _errors: IConfigError[] = []

  constructor (private _ctx: Context) {
    this._setBasePath()
  }

  /**
   * Sets the base path using the app root path from the context. Also
   * raises error if app root path is missing
   */
  private _setBasePath () {
    const appRoot = this._ctx.getPath('appRoot')

    if (!appRoot) {
      throw MissingPath.appRoot('config parser')
    }

    this._basePath = appRoot
    debug('app root %s', this._basePath)
  }

  /**
   * Reads the config file and raises error when file is missing or has
   * syntax errors.
   */
  private async _readFileAsJSON (relativePath: string, missingFileFn: Function) {
    try {
      return await readJson(join(this._ctx.getPath('appRoot')!, relativePath))
    } catch (err) {
      if (err.code === 'ENOENT') {
        missingFileFn()
      }
      throw err
    }
  }

  /**
   * This method makes sure that versions or zones exists and they
   * don't exists together as top level nodes.
   */
  private _validateTopLevelKeys (zones, versions) {
    if (versions && zones) {
      this._errors.push({
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
    /**
     * When defined as a string, then we consider it as a location
     * for the master version
     */
    if (zone && typeof (zone) === 'string') {
      return {
        slug: slug,
        name: slug,
        versions: { master: zone },
      }
    }

    /**
     * When it's an object, then we consider it as
     * a proper zone object and pick fields from
     * it.
     */
    if (this._isObject(zone)) {
      return {
        slug: zone.slug || slug,
        name: zone.name || zone.slug || slug,
        versions: zone.versions || {},
      }
    }

    /**
     * Fallback to empty object
     */
    return {
      slug: slug,
      name: slug,
      versions: {},
    }
  }

  /**
   * Normalizes an array of zones from the config file
   */
  private _normalizeZones (zones, versions) {
    /**
     * Create the default zone when it's missing as top level node
     */
    if (!zones) {
      return versions ? [{
        name: 'default',
        slug: 'default',
        versions: versions || {},
      }] : []
    }

    /**
     * If zones is not a valid object literal, then subsitute it with an
     * empty array
     */
    if (!this._isObject(zones)) {
      return []
    }

    /**
     * Normalize zones and set it back as normalized array
     */
    return Object.keys(zones).map((slug) => this._normalizeZone(zones[slug], slug))
  }

  /**
   * Normalizes a single version by addressing different input types.
   *
   * 1. If `versionNode` is a string, then it will be used as the docs location.
   * 2. If `versionNode` is an object, then values will be read of the object
   * 3. Otherwise ignored and empty object is returned.
   */
  private _normalizeVersion (versionNo, versionNode) {
    /**
     * If version is a string, then it will be considered as
     * the location of the version
     */
    if (typeof (versionNode) === 'string') {
      return {
        no: versionNo,
        location: versionNode,
        default: false,
        depreciated: false,
        draft: false,
      }
    }

    /**
     * If is object, then use object properties
     */
    if (this._isObject(versionNode)) {
      return {
        draft: !!versionNode.draft,
        depreciated: !!versionNode.depreciated,
        location: versionNode.location,
        default: !!versionNode.default,
        no: versionNode.no || versionNo,
      }
    }

    /**
     * Fallback to empty object
     */
    return {}
  }

  /**
   * Normalizes all versions inside all the zones and mutates
   * them in place
   */
  private _normalizeVersions (versions): IConfigVersion[] {
    if (!this._isObject(versions)) {
      return []
    }

    return Object.keys(versions).map((versionNo) => {
      return this._normalizeVersion(versionNo, versions[versionNo]) as IConfigVersion
    })
  }

  /**
   * Validates all zones and their versions to make sure, we have
   * enough info to process docs.
   */
  private _validateZones (zones) {
    if (!zones.length) {
      this._errors.push({
        message: 'Define atleast one version to process documentation',
        ruleId: 'missing-zones-and-versions',
      })
      return
    }

    zones.forEach((zone) => {
      if (!zone.slug) {
        this._errors.push({
          message: 'Make sure to define slug for all zones',
          ruleId: 'missing-zone-slug',
        })
      }
    })
  }

  /**
   * Validate all versions inside all zones.
   */
  private _validateVersions (versions) {
    versions.forEach((version) => {
      if (!version.no) {
        this._errors.push({
          message: 'Each version must have a version number',
          ruleId: 'missing-version-no',
        })
      }

      if (!version.location) {
        this._errors.push({
          message: 'Each version must specify the docs location',
          ruleId: 'missing-version-location',
        })
      }
    })
  }

  private async _readTranslation (locale, translations) {
    if (this._isObject(translations)) {
      return translations
    }

    if (typeof (translations) === 'string') {
      return await this._readFileAsJSON(translations, () => {
        throw FileNotFound.translationNotFound(locale, translations)
      })
    }

    return {}
  }

  /**
   * Normalize the translations object and inline translations if they
   * are defined as strings
   */
  private async _normalizeTranslations (translations): Promise<{ [key: string]: any }> {
    if (!translations || !this._isObject(translations)) {
      return {}
    }

    const normalized = {}

    /**
     * Normalize all translations. Some can be reference to the a file, so read
     * the file as JSON too
     */
    await Promise.all(Object.keys(translations).map(async (locale) => {
      try {
        normalized[locale] = await this._readTranslation(locale, translations[locale])
      } catch (error) {
        this._errors.push({
          message: error.message,
          ruleId: error.ruleId || 'internal-error',
        })
      }
    }))

    return normalized
  }

  /**
   * Reads the config file from the disk. This method will catch exceptions
   * and adds them to the `errors` array.
   */
  private async _readConfigFile (): Promise<IProjectConfig | null> {
    try {
      return await this._readFileAsJSON('dimer.json', () => {
        throw FileNotFound.missingConfigFile()
      })
    } catch (error) {
      this._errors.push({
        message: error.message,
        ruleId: error.ruleId || 'internal-error',
      })
      return null
    }
  }

  /**
   * Parse the config file and return the normalized config object or an array
   * of errors (if any)
   */
  public async parse (): Promise<{ errors: IConfigError[], config?: IProjectConfig }> {
    const config = await this._readConfigFile()
    if (!config) {
      return {
        errors: this._errors,
      }
    }

    /**
     * Validates the top level keys to make sure they are present
     * and not conflicting with each other. In case of errors
     * return them right away
     */
    this._validateTopLevelKeys(config.zones, (config as any).versions)
    if (this._errors.length) {
      return {
        errors: this._errors,
      }
    }

    /**
     * Normalize all the zones to be an array and nest versions inside
     * them, if they are outside
     */
    const zones = this._normalizeZones(config.zones, (config as any).versions) as IConfigZone[]
    zones.forEach((zone) => {
      zone.versions = this._normalizeVersions(zone.versions)
    })

    const translations = await this._normalizeTranslations(config.translations)

    /**
     * Validate normalized zones and versions
     */
    this._validateZones(zones)
    zones.forEach((zone) => {
      this._validateVersions(zone.versions)
    })

    return {
      errors: this._errors,
      config: {
        domain: config.domain,
        cname: config.cname,
        theme: config.theme,
        zones: zones,
        translations: translations,
        compilerOptions: config.compilerOptions || {},
        themeOptions: config.themeOptions || {},
      },
    }
  }
}
