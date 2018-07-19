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
 * @class MdServer
 *
 * @param {String} domain
 */
class MdServe {
  constructor (domain) {
    ow(domain, ow.string.label('domain').nonEmpty)

    this.domain = domain
    this.baseDir = join(__dirname, '../sites', this.domain)
    this.db = new Db(join(this.baseDir, 'meta.json'))
    this.searchJar = {}
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

    const metaData = _.reduce(doc, (result, value, key) => {
      if (key !== 'content') {
        result[key] = value
      }
      return result
    }, { jsonPath: filePath })

    metaData.category = metaData.category || 'root'
    metaData.title = metaData.title || this._getTitle(doc.content)

    await this.db.addDoc(versionNo, metaData, true)
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
    const versionsRemoved = _.differenceBy(this.db.getVersions(), versions, (version) => version.no)

    /**
     * Update/Add versions
     */
    versions.forEach((version) => (this.db.saveVersion(version, false)))

    /**
     * Remove non-existing versions
     */
    versionsRemoved.forEach((version) => (this.db.removeVersion(version.no, false)))

    /**
     * Remove content for the versions which are removed
     */
    await Promise.all([versionsRemoved.map((version) => fs.remove(join(this.baseDir, version.no)))])

    /**
     * Persist DB
     */
    await this.db.persist(true)
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
    await this.db.removeDoc(versionNo, filePath, true)
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
   * @method getDocs
   *
   * @param  {String}  versionNo
   * @param  {Boolean} [limit = 0]
   * @param  {Boolean} [withContent = false]
   *
   * @return {Array}
   */
  async getDocs (versionNo, limit = 0, withContent = false) {
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

    const doc = version.docs.find((doc) => doc.permalink === permalink)
    return this.loadContent(versionNo, doc)
  }

  /**
   * Syncs meta data and saves it to the disk
   *
   * @method syncMetaData
   *
   * @param  {Object}     metaData
   *
   * @return {void}
   */
  async syncMetaData (metaData) {
    return this.db.syncMetaData(metaData)
  }

  /**
   * Returns the meta data for the website
   *
   * @method getMetaData
   *
   * @return {Object}
   */
  getMetaData () {
    return _.omit(this.db.data, ['version'])
  }

  /**
   * Returns the search class instance for a given version
   *
   * @method searchFor
   *
   * @param  {String}  versionNo
   *
   * @return {Search}
   */
  searchFor (versionNo) {
    if (!this.searchJar[versionNo]) {
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
    const search = this.searchFor(versionNo)
    const categories = await this.getDocs(versionNo, 0, true)

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
}

module.exports = MdServe
