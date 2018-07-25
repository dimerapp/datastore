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

const Db = require('./Db')
const Search = require('./Search')

/**
 * A service to save website details, versions and related content
 *
 * @class Datastore
 *
 * @param {String} storageDir
 */
class Datastore {
  constructor (storageDir) {
    ow(storageDir, ow.string.label('storageDir').nonEmpty)
    this.baseDir = storageDir

    this.db = new Db(join(this.baseDir, 'meta.json'))
    this.searchJar = {}
  }

  /**
   * Removes trailing and leading slashes from the permalink. This
   * should always be done when matching permalinks, and do not
   * mutate the value of permalink saved by the end user.
   *
   * @method _normalizePermalink
   *
   * @param  {String}            permalink
   *
   * @return {String}
   *
   * @private
   */
  _normalizePermalink (permalink) {
    return permalink.replace(/^\/|\/$/, '')
  }

  /**
   * Returns the title node from the content nodes
   *
   * @method _getTitle
   *
   * @param  {Array}  options.children
   *
   * @return {String}
   *
   * @private
   */
  _getTitle ({ children }) {
    const node = children.find((child) => child.tag === 'dimerTitle')
    return node ? node.child[0].value : ''
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
    return filePath.replace(new RegExp(`${extname(filePath)}$`), '.json')
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
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)
    ow(doc, ow.object.label('doc').hasKeys('content', 'permalink'))
    filePath = this._normalizePath(filePath)

    /**
     * Make sure the permalink is not duplicate
     */
    const existingDoc = this.db.getDocByPermalink(versionNo, doc.permalink)
    if (existingDoc && existingDoc.jsonPath !== filePath) {
      const error = new Error(`Duplicate permalink ${doc.permalink}`)
      error.doc = existingDoc
      throw error
    }

    const metaData = _.reduce(doc, (result, value, key) => {
      if (key !== 'content') {
        result[key] = value
      }
      return result
    }, { jsonPath: filePath })

    metaData.category = metaData.category || 'root'
    metaData.title = metaData.title || this._getTitle(doc.content)

    this.db.addDoc(versionNo, metaData)
    await fs.outputJSON(join(this.baseDir, versionNo, filePath), doc.content)
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
    const existingVersions = this.db.getVersions().map((version) => version)
    const versionsRemoved = _.differenceBy(existingVersions, versions, (version) => version.no)

    /**
     * Update/Add versions
     */
    versions.forEach((version) => (this.db.saveVersion(version)))

    /**
     * Pulling from the latest database copy to get the normalized
     * copy of versions
     */
    const versionsAdded = _.differenceBy(this.db.getVersions(), existingVersions, (version) => version.no)

    /**
     * Remove non-existing versions
     */
    versionsRemoved.forEach((version) => (this.db.removeVersion(version.no)))

    /**
     * Remove content for the versions which are removed
     */
    await Promise.all([versionsRemoved.map((version) => fs.remove(join(this.baseDir, version.no)))])

    return { added: versionsAdded, removed: versionsRemoved }
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
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)

    filePath = this._normalizePath(filePath)

    await fs.remove(join(this.baseDir, versionNo, filePath))
    this.db.removeDoc(versionNo, filePath)
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
   *
   * @return {Object}
   */
  async loadContent (versionNo, doc) {
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(doc, ow.object.label('doc').hasKeys('jsonPath'))

    const content = await fs.readJSON(join(this.baseDir, versionNo, doc.jsonPath))
    return Object.assign({ content }, doc)
  }

  /**
   * Returns an array of docs nested under categories
   *
   * @method getTree
   *
   * @param  {String}  versionNo
   * @param  {Boolean} [limit = 0]
   * @param  {Boolean} [withContent = false]
   *
   * @return {Array}
   */
  async getTree (versionNo, limit = 0, withContent = false) {
    ow(versionNo, ow.string.label('versionNo').nonEmpty)

    const version = this.db.getVersion(versionNo)
    if (!version) {
      return []
    }

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
      docs = await Promise.all(docs.map((doc) => this.loadContent(versionNo, doc)))
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
      category.docs.push(doc)

      return categories
    }, [])
  }

  /**
   * Returns the doc with the content
   *
   * @method getDoc
   *
   * @param  {String} versionNo
   * @param  {String} filePath
   *
   * @return {Object}
   */
  async getDoc (versionNo, filePath) {
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)

    const version = this.db.getVersion(versionNo)

    if (!version) {
      return null
    }

    const doc = version.docs.find((doc) => doc.jsonPath === this._normalizePath(filePath))

    if (!doc) {
      return null
    }

    return this.loadContent(versionNo, doc)
  }

  /**
   * Return doc by permalink
   *
   * @method getDocByPermalink
   *
   * @param  {String}          versionNo
   * @param  {String}          permalink
   *
   * @return {Object}
   */
  async getDocByPermalink (versionNo, permalink) {
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(permalink, ow.string.label('permalink').nonEmpty)

    const version = this.db.getVersion(versionNo)

    if (!version) {
      return null
    }

    const doc = version.docs.find((doc) => {
      return this._normalizePermalink(doc.permalink) === this._normalizePermalink(permalink)
    })

    if (!doc) {
      return null
    }

    return this.loadContent(versionNo, doc)
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
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(permalink, ow.string.label('permalink').nonEmpty)

    const version = this.db.getVersion(versionNo)

    if (!version) {
      return null
    }

    const doc = version.docs.find((doc) => {
      return _.includes(doc.redirects.map(this._normalizePermalink.bind(this)), this._normalizePermalink(permalink))
    })

    if (!doc) {
      return null
    }

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
    return _.omit(this.db.data, ['version'])
  }

  /**
   * Returns the search class instance for a given version
   *
   * @method searchFor
   *
   * @param  {String}   versionNo
   * @param  {Boolean}  forceNew
   *
   * @return {Search}
   */
  searchFor (versionNo, forceNew = false) {
    if (!this.searchJar[versionNo] || forceNew) {
      this.searchJar[versionNo] = new Search(join(this.baseDir, versionNo, 'search.json'))
    }

    return this.searchJar[versionNo]
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
    const search = this.searchFor(versionNo, true)
    const categories = await this.getTree(versionNo, 0, true)

    categories.forEach(({ docs }) => {
      docs.forEach((doc) => {
        search.addDoc(doc.content, doc.permalink)
      })
    })

    await search.save()
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
    const search = this.searchFor(versionNo)
    if (!search.readIndex) {
      await search.load()
    }

    return search.search(term)
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
      await fs.remove(this.baseDir)
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
