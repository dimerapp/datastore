/*
* md-server
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const fs = require('fs-extra')
const { join, extname } = require('path')
const _ = require('lodash')
const ow = require('ow')
const utils = require('@dimerapp/utils')
const slash = require('slash')

const Db = require('./Db')
const Index = require('./Index')
const Search = require('./Search')

/**
 * A service to save website details, versions and related content
 *
 * @class Datastore
 *
 * @param {String} storageDir
 */
class Datastore {
  constructor (ctx) {
    this.ctx = ctx
    this.db = new Db(this.ctx.paths.metaFile())
  }

  /**
   * Normalizes the path of the doc content file
   *
   * @method _normalizePath
   *
   * @param  {String}       filePath
   *
   * @return {String}
   *
   * @private
   */
  _normalizePath (filePath) {
    return slash(filePath).replace(new RegExp(`${extname(filePath)}$`), '.json')
  }

  /**
   * Saves the doc to the disk and update meta db
   *
   * @method saveDoc
   *
   * @param  {String} versionNo
   * @param  {String} filePath
   * @param  {Object} doc
   *
   * @return {void}
   */
  async saveDoc (versionNo, filePath, doc) {
    /**
     * Validations before consuming data
     */
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)
    ow(doc, ow.object.label('doc').hasKeys('content', 'permalink', 'title'))

    ow(doc.permalink, ow.string.label('doc.permalink').nonEmpty)
    ow(doc.title, ow.string.label('doc.title').nonEmpty)

    /**
     * Normalize the file path and convert it to .json file
     */
    const jsonPath = this._normalizePath(filePath)

    /**
     * Make sure the permalink is not duplicate
     */
    const existingDoc = this.db.duplicateDoc(versionNo, doc.permalink, jsonPath)
    if (existingDoc) {
      const mdName = existingDoc.jsonPath.replace(/\.json$/, '.md')
      const error = new Error(`${mdName} also using the same permalink: ${doc.permalink}`)
      error.ruleId = 'duplicate-permalink'
      throw error
    }

    /**
     * Build meta data by copying all the fields, except content
     */
    const metaData = _.omit(doc, 'content')

    /**
     * Save required properties to metaData
     */
    metaData.jsonPath = jsonPath
    metaData.category = metaData.category || 'root'

    /**
     * Save actual file
     */
    await fs.outputJSON(join(this.ctx.paths.versionPath(versionNo), jsonPath), doc.content)

    /**
     * Add to db
     */
    this.db.addDoc(versionNo, metaData)
  }

  /**
   * Syncs all the versions to the db
   *
   * @method syncVersions
   *
   * @param  {Array}     versions
   *
   * @return {void}
   */
  async syncVersions (versions) {
    ow(versions, ow.array.label('versions'))

    /**
     * An array of versions that already exists in the database
     */
    const existingVersions = this.db.getVersions().map((version) => version)

    /**
     * An array of versions removed in the new set of versions we have received
     */
    const removed = _.differenceBy(existingVersions, versions, (version) => version.no)

    /**
     * Update existing or add new versions
     */
    versions.forEach((version) => (this.db.saveVersion(version)))

    /**
     * Pulling from the latest database copy to get the normalized
     * copy of versions
     */
    const added = _.differenceBy(this.db.getVersions(), existingVersions, (version) => version.no)

    /**
     * Remove non-existing versions
     */
    removed.forEach((version) => (this.db.removeVersion(version.no)))

    /**
     * Remove content for all versions which are removed. This includes
     * the version files and search indexes.
     */
    await Promise.all([removed.map((version) => {
      return fs.remove(this.ctx.paths.versionPath(version.no))
    })])

    return { added, removed }
  }

  /**
   * Remove doc using it's path for a given version
   *
   * @method removeDoc
   *
   * @param  {String}  versionNo
   * @param  {String}  filePath
   *
   * @return {void}
   */
  async removeDoc (versionNo, filePath) {
    /**
     * Validations
     */
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)

    const jsonPath = this._normalizePath(filePath)

    /**
     * Drop the actual content file from disk
     */
    await fs.remove(join(this.ctx.paths.versionPath(versionNo), jsonPath))

    /**
     * Update db
     */
    this.db.removeDoc(versionNo, jsonPath)
  }

  /**
   * Returns an array of versions
   *
   * @method getVersions
   *
   * @return {Array}
   */
  getVersions () {
    return this.db.getVersions().map((version) => {
      version.heroDoc = this.db.getVersion(version.no).docs[0] || null
      return version
    })
  }

  /**
   * Loads content for a given doc and attaches it as a property
   * on the object.
   *
   * Returns a new object (doesn't mutate the old one)
   *
   * @method loadContent
   *
   * @param  {String}    versionNo
   * @param  {Object}    doc
   * @param  {Boolean}   [attachVersion = false]
   *
   * @return {Object}
   */
  async loadContent (versionNo, doc, attachVersion = false) {
    /**
     * Validations
     */
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(doc, ow.object.label('doc').hasKeys('jsonPath'))
    ow(doc.jsonPath, ow.string.label('doc.jsonPath').nonEmpty)

    const content = await fs.readJSON(join(this.ctx.paths.versionPath(versionNo), doc.jsonPath))
    const finalDoc = _.omit(Object.assign({ content }, doc), 'jsonPath')

    /**
     * Attach the version node to the doc, when request for it
     */
    if (attachVersion) {
      finalDoc.version = _.omit(this.db.getVersion(versionNo), 'docs')
    }

    return finalDoc
  }

  /**
   * Returns an array of docs nested under categories
   *
   * @method getTree
   *
   * @param  {String}  versionNo
   * @param  {Boolean} [limit = 0]
   * @param  {Boolean} [withContent = false]
   * @param  {Boolean} [attachVersion = false]
   *
   * @return {Array|Null}
   */
  async getTree (versionNo, limit = 0, withContent = false, attachVersion = false) {
    ow(versionNo, ow.string.label('versionNo').nonEmpty)

    /**
     * If version doesn't exists, return null. This is to
     * differentiate between non-existing version and
     * version with no docs.
     */
    const version = this.db.getVersion(versionNo)
    if (!version) {
      return null
    }

    /**
     * Order docs by jsonPath
     */
    let docs = _.orderBy(version.docs, 'jsonPath')

    /**
     * Limit the docs if limit exists
     */
    if (limit) {
      docs = _.take(docs, limit)
    }

    /**
     * If withContent, then ready content for all the docs and add it as
     * a node
     */
    if (withContent) {
      docs = await Promise.all(docs.map((doc) => this.loadContent(versionNo, doc, attachVersion)))
    }

    return docs.reduce((categories, doc) => {
      let category = categories.find((category) => category.category === doc.category)

      /**
       * If category doesn't exists, create a new one and push
       * to categories array
       */
      if (!category) {
        category = { category: doc.category, docs: [] }
        categories.push(category)
      }

      category.docs.push(_.omit(doc, 'jsonPath'))

      return categories
    }, [])
  }

  /**
   * Returns the doc with the content
   *
   * @method getDoc
   *
   * @param  {String}  versionNo
   * @param  {String}  filePath
   * @param  {Boolean} attachVersion
   *
   * @return {Object}
   */
  async getDoc (versionNo, filePath, attachVersion) {
    const doc = this.db.getDoc(versionNo, this._normalizePath(filePath))

    /**
     * Return null if doc is missing
     */
    if (!doc) {
      return null
    }

    return this.loadContent(versionNo, doc, attachVersion)
  }

  /**
   * Return doc by permalink
   *
   * @method getDocByPermalink
   *
   * @param  {String}     versionNo
   * @param  {String}     permalink
   * @param  {Boolean}    [attachVersion = false]
   *
   * @return {Object}
   */
  async getDocByPermalink (versionNo, permalink, attachVersion = false) {
    const doc = this.db.getDocByPermalink(versionNo, permalink)

    /**
     * Return null if doc is missing
     */
    if (!doc) {
      return null
    }

    return this.loadContent(versionNo, doc, attachVersion)
  }

  /**
   * Returns the permalink at which the doc must be redirected. If
   * there are no redirects then `null` is returned
   *
   * @method redirectedPermalink
   *
   * @param  {String}            versionNo
   * @param  {String}            permalink
   *
   * @return {String|Null}
   */
  redirectedPermalink (versionNo, permalink) {
    /**
     * Validations
     */
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(permalink, ow.string.label('permalink').nonEmpty)

    /**
     * Return null if version is missing
     */
    const version = this.db.getVersion(versionNo)
    if (!version) {
      return null
    }

    /**
     * Get the doc in which the redirects are same
     * the current permalink
     */
    const doc = version.docs
      .filter((doc) => Array.isArray(doc.redirects))
      .find((doc) => {
        return _.includes(doc.redirects.map(utils.permalink.normalize), utils.permalink.normalize(permalink))
      })

    /**
     * Return null if doc is missing
     */
    if (!doc) {
      return null
    }

    /**
     * Otherwise return the permalink
     */
    return doc.permalink
  }

  /**
   * Syncs meta data and saves it to the disk
   *
   * @method syncConfig
   *
   * @param  {Object}     metaData
   *
   * @return {void}
   */
  async syncConfig (metaData) {
    this.db.syncMetaData(metaData)
    return this.db.persist()
  }

  /**
   * Returns the meta data for the website
   *
   * @method getConfig
   *
   * @return {Object}
   */
  getConfig () {
    return _.omit(this.db.data, ['versions', 'compilerOptions'])
  }

  /**
   * Creates a search index for a given version
   *
   * @method indexVersion
   *
   * @param  {String}     versionNo
   *
   * @return {void}
   */
  async indexVersion (versionNo) {
    ow(versionNo, ow.string.label('versionNo').nonEmpty)

    const index = new Index(this.ctx.paths.searchIndexFile(versionNo))

    /**
     * Get the entire tree with the loaded content
     */
    const tree = await this.getTree(versionNo, 0, true)

    tree.forEach(({ docs }) => {
      docs.forEach((doc) => {
        index.addDoc(doc.content, doc.permalink)
      })
    })

    /**
     * Write index to the disk
     */
    await index.save()
  }

  /**
   * Search content for a given term
   *
   * @method search
   *
   * @param  {String} versionNo
   * @param  {String} term
   *
   * @return {Array}
   */
  async search (versionNo, term) {
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(versionNo, ow.string.label('term').nonEmpty)

    return Search.search(this.ctx.paths.searchIndexFile(versionNo), term)
  }

  /**
   * Load database. If `clean` is set to true, then it will
   * start from a blank slate.
   *
   * @method load
   *
   * @param  {Boolean} [clean = false]
   *
   * @return {void}
   */
  async load (clean = false) {
    if (clean) {
      await fs.remove(this.ctx.paths.apiPath())
    }

    await this.db.load()
  }

  /**
   * Persist store with changes
   *
   * @method persist
   *
   * @return {void}
   */
  persist () {
    return this.db.persist()
  }
}

module.exports = Datastore
