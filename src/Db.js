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
const ChangeSet = require('./ChangeSet')

/**
 * The database for storing everything on disk
 *
 * @class Db
 *
 * @param {String} filePath
 * @param {Object} options
 */
class Db {
  constructor (filePath, options = {}) {
    this.filePath = filePath
    this.onReady = typeof (options.onReady) === 'function' ? options.onReady : function () {}
    this.data = { versions: [] }
    this.loaded = false

    if (options.autoload) {
      this.load()
    }
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
    await fs.ensureFile(this.filePath)

    try {
      const data = await fs.readJSON(this.filePath)
      this.data = {
        versions: (data.versions || []).map((version) => this._normalizeVersion(version))
      }
    } catch (error) {
    }

    this.loaded = true
    this.onReady()
  }

  /**
   * Writes contents to the disk
   *
   * @method persist
   *
   * @return {void}
   */
  persist (persist) {
    if (!persist) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      steno.writeFile(this.filePath, JSON.stringify(this.data), (error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  /**
   * Saves a version with versionNo. This method will update the existing
   * row, if already exists.
   *
   * @method saveVersion
   *
   * @param  {Object}    payload
   * @param  {Boolean}   persist
   *
   * @return {Object}
   */
  async saveVersion (payload, persist = true) {
    this._ensureIsLoaded()

    ow(payload, ow.object.label('payload').hasKeys('no'))
    const version = this.getVersion(payload.no)

    /**
     * Add a new version, when doesn't exists
     */
    if (!version) {
      payload = this._normalizeVersion(payload)
      this.data.versions.push(payload)

      await this.persist(persist)
      return payload
    }

    /**
     * Create a new changeset to find what's really changed
     */
    const changset = new ChangeSet(version)
    changset.merge(payload)

    /**
     * If there are dirty fields, then just merge and use them
     */
    const dirty = changset.dirty
    if (_.size(dirty)) {
      Object.assign(version, dirty)
      await this.persist(persist)
    }

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
   * @param  {Boolean} persist
   */
  async addDoc (versionNo, payload, persist = true) {
    this._ensureIsLoaded()

    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(payload, ow.object.label('payload').hasKeys('permalink', 'jsonPath', 'title', 'category'))

    /**
     * Save version if not already created
     */
    const version = await this.saveVersion({ no: versionNo }, false)

    const doc = _.find(version.docs, (d) => d.jsonPath === payload.jsonPath)

    /**
     * Add a new doc to the version, when doc doesn't exists
     */
    if (!doc) {
      version.docs.push(payload)
      await this.persist(persist)
      return payload
    }

    /**
     * Create a new changeset for finding changes
     */
    const changset = new ChangeSet(doc)
    changset.merge(payload)

    /**
     * If there are dirty fields, then just merge and use them
     */
    const dirty = changset.dirty
    if (_.size(dirty)) {
      Object.assign(doc, payload)
      await this.persist(persist)
    }

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
   * @param  {Boolean}     persist
   *
   * @return {void}
   */
  async removeVersion (no, persist = true) {
    this._ensureIsLoaded()

    ow(no, ow.string.label('no').nonEmpty)
    const removed = _.remove(this.data.versions, (version) => version.no === no)

    if (removed.length) {
      await this.persist(persist)
    }
  }

  /**
   * Removes a doc with the json path and for a given version
   *
   * @method removeDoc
   *
   * @param  {String}  versionNo
   * @param  {String}  jsonPath
   * @param  {Boolean} persist
   *
   * @return {void}
   */
  async removeDoc (versionNo, jsonPath, persist = true) {
    this._ensureIsLoaded()

    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(jsonPath, ow.string.label('jsonPath').nonEmpty)

    const version = this.getVersion(versionNo)
    if (!version) {
      return
    }

    const removed = _.remove(version.docs, (doc) => doc.jsonPath === jsonPath)

    if (removed.length) {
      await this.persist(persist)
    }
  }

  /**
   * Returns a specific version node using versionNo
   *
   * @method getVersion
   *
   * @param  {String}   versionNo
   *
   * @return {Object|undefined}
   */
  getVersion (no) {
    this._ensureIsLoaded()

    ow(no, ow.string.label('no').nonEmpty)
    return _.find(this.data.versions, (version) => version.no === no)
  }

  /**
   * Returns a specific doc for a given version
   *
   * @method getDoc
   *
   * @param  {String} versionNo
   * @param  {String} permalink
   *
   * @return {Object|undefined}
   */
  getDoc (versionNo, permalink) {
    this._ensureIsLoaded()

    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(versionNo, ow.string.label('permalink').nonEmpty)

    const version = this.getVersion(versionNo)
    if (!version) {
      return
    }

    return _.find(version.docs, (doc) => doc.permalink === permalink)
  }
}

module.exports = Db
