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
    this.data = { versions: [] }
    this.loaded = false
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
   * Returns a boolean telling if file is valid for writes and
   * reads
   *
   * @method isFileValid
   *
   * @return {Boolean}
   */
  isFileValid () {
    this._ensureIsLoaded()

    if (!this.data.versions) {
      return false
    }

    if (!this.data.versions.length) {
      return true
    }

    return !_.some(this.data.versions, (version) => {
      if (!version.no || !version.name || !version.docs) {
        return true
      }

      if (!version.docs.length) {
        return false
      }

      return _.some(version.docs, (doc) => {
        return !doc.permalink || !doc.jsonPath || !doc.category || !doc.title
      })
    })
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
      this.data.versions = (this.data.versions || []).map((version) => this._normalizeVersion(version))
    } catch (error) {
      this.data = {
        versions: []
      }
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
    ow(metaData, ow.object.label('metaData').hasKeys('domain'))
    const versions = this.data.versions
    this.data = _.omit(metaData, ['versions'])
    this.data.versions = versions
  }

  /**
   * Saves a version with versionNo. This method will update the existing
   * row, if already exists.
   *
   * @method saveVersion
   *
   * @param  {Object}    payload
   *
   * @return {Object}
   */
  saveVersion (payload) {
    this._ensureIsLoaded()

    ow(payload, ow.object.label('payload').hasKeys('no'))
    ow(payload.no, ow.string.label('payload.no').nonEmpty)

    const version = this.getVersion(payload.no)

    /**
     * Add a new version, when doesn't exists
     */
    if (!version) {
      payload = this._normalizeVersion(payload)
      this.data.versions.push(payload)
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
   * @param  {String}  payload
   */
  addDoc (versionNo, payload) {
    this._ensureIsLoaded()

    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(payload, ow.object.label('payload').hasKeys('permalink', 'jsonPath', 'title', 'category'))

    ow(payload.permalink, ow.string.label('payload.permalink').nonEmpty)
    ow(payload.jsonPath, ow.string.label('payload.jsonPath').nonEmpty)
    ow(payload.title, ow.string.label('payload.title').nonEmpty)
    ow(payload.category, ow.string.label('payload.category').nonEmpty)

    /**
     * Save version if not already created
     */
    const version = this.saveVersion({ no: versionNo })
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

  /**
   * Returns an array of existing versions
   *
   * @method getVersions
   *
   * @return {Array}
   */
  getVersions () {
    this._ensureIsLoaded()
    return this.data.versions.map((version) => _.omit(version, ['docs']))
  }

  /**
   * Removes a given version and it's docs
   *
   * @method removeVersion
   *
   * @param  {String}      no
   *
   * @return {void}
   */
  removeVersion (no) {
    this._ensureIsLoaded()

    ow(no, ow.string.label('no').nonEmpty)
    _.remove(this.data.versions, (version) => version.no === no)
  }

  /**
   * Removes a doc with the json path and for a given version
   *
   * @method removeDoc
   *
   * @param  {String}  versionNo
   * @param  {String}  jsonPath
   *
   * @return {void}
   */
  removeDoc (versionNo, jsonPath) {
    this._ensureIsLoaded()

    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(jsonPath, ow.string.label('jsonPath').nonEmpty)

    const version = this.getVersion(versionNo)
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
  getVersion (no) {
    this._ensureIsLoaded()

    ow(no, ow.string.label('no').nonEmpty)
    return _.find(this.data.versions, (version) => version.no === no) || null
  }

  /**
   * Returns the doc with it's json path
   *
   * @method getDoc
   *
   * @param  {String} versionNo
   * @param  {String} jsonPath
   *
   * @return {Object|Null}
   */
  getDoc (versionNo, jsonPath) {
    this._ensureIsLoaded()

    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(versionNo, ow.string.label('permalink').nonEmpty)

    const version = this.getVersion(versionNo)
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
   * @param  {String} permalink
   *
   * @return {Object|null}
   */
  getDocByPermalink (versionNo, permalink) {
    this._ensureIsLoaded()

    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(versionNo, ow.string.label('permalink').nonEmpty)

    const version = this.getVersion(versionNo)
    if (!version) {
      return null
    }

    return version.docs.find((doc) => utils.permalink.isSame(doc.permalink, permalink)) || null
  }

  /**
   * Returns the doc that has the same permalink for
   * a given version
   *
   * @method duplicateDoc
   *
   * @param  {String}    versionNo
   * @param  {String}    permalink
   * @param  {String}    jsonPath
   *
   * @return {Null|Object}
   */
  duplicateDoc (versionNo, permalink, jsonPath) {
    const version = this.getVersion(versionNo)
    if (!version) {
      return null
    }

    return version.docs.find((doc) => {
      return utils.permalink.isSame(doc.permalink, permalink) && doc.jsonPath !== jsonPath
    }) || null
  }
}

module.exports = Db
