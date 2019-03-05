/* md-serve
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const fs = require('fs-extra')
const steno = require('steno')
const _ = require('lodash')
const ow = require('ow')
const utils = require('@dimerapp/utils')

/**
 * The database for storing everything on disk
 *
 * @class Db
 *
 * @param {String} filePath
 * @param {Object} options
 */
class Db {
  constructor (filePath) {
    this.filePath = filePath
    this.data = this._initialPayload()
    this.loaded = false
  }

  /**
   * Returns the initial payload, when nothing is in the store
   *
   * @method _initialPayload
   *
   * @return {Object}
   *
   * @private
   */
  _initialPayload () {
    return { zones: [] }
  }

  /**
   * Normalizes the version node with defaults
   *
   * @method _normalizeVersion
   *
   * @param  {Object}          version
   *
   * @return {Object}
   *
   * @private
   */
  _normalizeVersion (version) {
    return Object.assign({
      default: false,
      depreciated: false,
      draft: false,
      name: version.no,
      docs: []
    }, version)
  }

  /**
   * Normalize the zone node
   *
   * @method _normalizeZone
   *
   * @param  {Object}       zone
   *
   * @return {Object}
   *
   * @private
   */
  _normalizeZone (zone) {
    return Object.assign({
      name: zone.slug
    }, zone)
  }

  /**
   * Throws an error if db is not ready
   *
   * @method _ensureIsLoaded
   *
   * @return {void}
   *
   * @private
   */
  _ensureIsLoaded () {
    if (!this.loaded) {
      throw new Error('Wait for the db to be ready. Move your code inside the onReady callback')
    }
  }

  /**
   * Returns a boolean telling if the array has valid shape
   * for docs.
   *
   * @method _areDocsValid
   *
   * @param  {Array}      docs
   *
   * @return {Boolean}
   *
   * @private
   */
  _areDocsValid (docs) {
    return _.every(docs, (doc) => {
      return doc.permalink && doc.jsonPath && doc.category && doc.title
    })
  }

  /**
   * Returns a boolean telling, if array has valid shape for verions.
   * Also each version will check it's child docs shape too
   *
   * @method _areVersionsValid
   *
   * @param  {Array}          versions
   *
   * @return {Boolean}
   *
   * @private
   */
  _areVersionsValid (versions) {
    return _.every(versions, (version) => {
      if (!version.no || !version.name || !version.docs) {
        return false
      }

      return this._areDocsValid(version.docs)
    })
  }

  /**
   * Returns a boolean, telling if the array is valid for the shape
   * of zone. Each zone will check it's versions and versions will
   * check their docs
   *
   * @method _areZonesValid
   *
   * @param  {Array}       zones
   *
   * @return {Boolean}
   *
   * @private
   */
  _areZonesValid (zones) {
    return _.every(zones, (zone) => {
      if (!zone.slug || !zone.name || !zone.versions) {
        return false
      }

      return this._areVersionsValid(zone.versions)
    })
  }

  /**
   * Returns a boolean telling if file is valid for writes and
   * reads
   *
   * @method isFileValid
   *
   * @return {Boolean}
   */
  isFileValid () {
    this._ensureIsLoaded()

    if (!this.data.zones) {
      return false
    }

    return this._areZonesValid(this.data.zones)
  }

  /**
   * Reads the contents from the disk
   *
   * @method _loadContents
   *
   * @return {void}
   */
  async load () {
    try {
      this.data = await fs.readJSON(this.filePath)
      this.data.zones = (this.data.zones || []).map((zone) => {
        zone = this._normalizeZone(zone)
        zone.versions = zone.versions.map((version) => this._normalizeVersion(version))
        return zone
      })
    } catch (error) {
      this.data = this._initialPayload()
    }

    this.loaded = true
  }

  /**
   * Writes contents to the disk
   *
   * @method persist
   *
   * @return {void}
   */
  persist () {
    return new Promise((resolve, reject) => {
      fs
        .ensureFile(this.filePath)
        .then(() => {
          steno.writeFile(this.filePath, JSON.stringify(this.data), (error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        })
        .catch(reject)
    })
  }

  /**
   * Sync the meta data to the database
   *
   * @method syncMetaData
   *
   * @param  {Object}     metaData
   *
   * @return {void}
   */
  syncMetaData (metaData) {
    this._ensureIsLoaded()

    const zones = this.data.zones
    this.data = _.omit(metaData, ['zones'])
    this.data.zones = zones
  }

  /**
   * Get the zone for a given slug
   *
   * @method getZone
   *
   * @param  {String} slug
   *
   * @return {Object|Null}
   */
  getZone (slug) {
    this._ensureIsLoaded()

    ow(slug, ow.string.label('slug').nonEmpty)
    return _.find(this.data.zones, (zone) => zone.slug === slug) || null
  }

  /**
   * Saves/updates the zone. The uniqueness if maintained
   * using hte `slug` key.
   *
   * @method saveZone
   *
   * @param  {Object} payload
   *
   * @return {Object}
   */
  saveZone (payload) {
    this._ensureIsLoaded()

    if (payload.versions) {
      throw new Error('Make use of syncVersions to update version for a zone')
    }

    ow(payload, ow.object.label('payload').hasKeys('slug'))
    ow(payload.slug, ow.string.label('payload.slug').nonEmpty)

    const zone = this.getZone(payload.slug)

    /**
     * Create zone, when one doesn't exists
     */
    if (!zone) {
      payload = this._normalizeZone(payload)
      payload.versions = []
      this.data.zones.push(payload)
      return payload
    }

    Object.assign(zone, payload)
    return zone
  }

  /**
   * Saves a version with versionNo. This method will update the existing
   * row, if already exists.
   *
   * @method saveVersion
   *
   * @param  {String}    zoneSlug
   * @param  {Object}    payload
   *
   * @return {Object}
   */
  saveVersion (zoneSlug, payload) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(payload, ow.object.label('payload').hasKeys('no'))
    ow(payload.no, ow.string.label('payload.no').nonEmpty)

    const zone = this.saveZone({ slug: zoneSlug })
    const version = this.getVersion(zone.slug, payload.no)

    /**
     * Add a new version, when doesn't exists
     */
    if (!version) {
      payload = this._normalizeVersion(payload)
      zone.versions.push(payload)
      return payload
    }

    Object.assign(version, payload)
    return version
  }

  /**
   * Add a new doc for a given version. Version will be created if missing.
   * Doc will be updated, if already exists
   *
   * @method addDoc
   *
   * @param  {String}  versionNo
   * @param  {String}  zoneSlug
   * @param  {String}  payload
   */
  addDoc (zoneSlug, versionNo, payload) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(payload, ow.object.label('payload').hasKeys('permalink', 'jsonPath', 'title', 'category'))

    /**
     * Doc property validations
     */
    ow(payload.permalink, ow.string.label('payload.permalink').nonEmpty)
    ow(payload.jsonPath, ow.string.label('payload.jsonPath').nonEmpty)
    ow(payload.title, ow.string.label('payload.title').nonEmpty)
    ow(payload.category, ow.string.label('payload.category').nonEmpty)

    /**
     * Save/update version
     */
    const version = this.saveVersion(zoneSlug, { no: versionNo })
    const doc = _.find(version.docs, (d) => d.jsonPath === payload.jsonPath)

    /**
     * Add a new doc to the version, when doc doesn't exists
     */
    if (!doc) {
      version.docs.push(payload)
      return payload
    }

    Object.assign(doc, payload)
    return doc
  }

  getZones () {
    this._ensureIsLoaded()
    return this.data.zones
  }

  /**
   * Returns an array of existing versions for a given
   * zone.
   *
   * @method getVersions
   *
   * @param {String} zoneSlug
   *
   * @return {Array|Null}
   */
  getVersions (zoneSlug) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    const zone = this.getZone(zoneSlug)

    if (!zone) {
      return null
    }

    return zone.versions.map((version) => _.omit(version, ['docs']))
  }

  /**
   * Remove zone using it's slug.
   *
   * @method removeZone
   *
   * @param  {String}   zoneSlug
   *
   * @return {void}
   */
  removeZone (zoneSlug) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    _.remove(this.data.zones, (zone) => zone.slug === zoneSlug)
  }

  /**
   * Removes a given version and it's docs.
   *
   * @method removeVersion
   *
   * @param  {String}      zoneSlug
   * @param  {String}      no
   *
   * @return {void}
   */
  removeVersion (zoneSlug, no) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(no, ow.string.label('no').nonEmpty)

    const zone = this.getZone(zoneSlug)
    if (!zone) {
      return
    }

    _.remove(zone.versions, (version) => version.no === no)
  }

  /**
   * Removes a doc with the json path and for a given version
   *
   * @method removeDoc
   *
   * @param  {String}  zoneSlug
   * @param  {String}  versionNo
   * @param  {String}  jsonPath
   *
   * @return {void}
   */
  removeDoc (zoneSlug, versionNo, jsonPath) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(jsonPath, ow.string.label('jsonPath').nonEmpty)

    const version = this.getVersion(zoneSlug, versionNo)
    if (!version) {
      return
    }

    _.remove(version.docs, (doc) => doc.jsonPath === jsonPath)
  }

  /**
   * Returns a specific version node using versionNo
   *
   * @method getVersion
   *
   * @param  {String}   versionNo
   *
   * @return {Object|null}
   */
  getVersion (zoneSlug, no) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(no, ow.string.label('no').nonEmpty)

    const zone = this.getZone(zoneSlug)
    if (!zone) {
      return null
    }

    return _.find(zone.versions, (version) => version.no === no) || null
  }

  /**
   * Returns the doc with it's json path
   *
   * @method getDoc
   *
   * @param  {String} zoneSlug
   * @param  {String} versionNo
   * @param  {String} jsonPath
   *
   * @return {Object|Null}
   */
  getDoc (zoneSlug, versionNo, jsonPath) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(jsonPath, ow.string.label('jsonPath').nonEmpty)

    const version = this.getVersion(zoneSlug, versionNo)
    if (!version) {
      return null
    }

    return version.docs.find((doc) => doc.jsonPath === jsonPath) || null
  }

  /**
   * Returns a specific doc for a given version
   *
   * @method getDocByPermalink
   *
   * @param  {String} versionNo
   * @param  {String} zoneSlug
   * @param  {String} permalink
   *
   * @return {Object|null}
   */
  getDocByPermalink (zoneSlug, versionNo, permalink) {
    this._ensureIsLoaded()

    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(versionNo, ow.string.label('permalink').nonEmpty)

    const version = this.getVersion(zoneSlug, versionNo)
    if (!version) {
      return null
    }

    return version.docs.find((doc) => utils.permalink.isSame(doc.permalink, permalink)) || null
  }

  /**
   * Returns the doc that has the same permalink for
   * a given version
   *
   * @method findDuplicateDoc
   *
   * @param  {String}    zoneSlug
   * @param  {String}    versionNo
   * @param  {String}    permalink
   * @param  {String}    jsonPath
   *
   * @return {Null|Object}
   */
  findDuplicateDoc (zoneSlug, versionNo, permalink, jsonPath) {
    const version = this.getVersion(zoneSlug, versionNo)
    if (!version) {
      return null
    }

    return version.docs.find((doc) => {
      return utils.permalink.isSame(doc.permalink, permalink) && doc.jsonPath !== jsonPath
    }) || null
  }
}

module.exports = Db
