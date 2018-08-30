/*
* md-server
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const fs = require('fs-extra')
const { join } = require('path')
const _ = require('lodash')
const ow = require('ow')
const utils = require('@dimerapp/utils')

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
    this.paths = ctx.get('paths')
    this.db = new Db(this.paths.metaFile())
  }

  /**
   * Saves the doc to the disk and update meta db
   *
   * @method saveDoc
   *
   * @param  {String} zoneSlug
   * @param  {String} versionNo
   * @param  {String} filePath
   * @param  {Object} doc
   *
   * @return {void}
   */
  async saveDoc (zoneSlug, versionNo, filePath, doc) {
    /**
     * Validations before consuming data
     */
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)
    ow(doc, ow.object.label('doc').hasKeys('content', 'permalink', 'title'))

    ow(doc.permalink, ow.string.label('doc.permalink').nonEmpty)
    ow(doc.title, ow.string.label('doc.title').nonEmpty)

    /**
     * Normalize the file path and convert it to .json file
     */
    const jsonPath = this.paths.makeJsonPath(filePath)

    /**
     * Make sure the permalink is not duplicate
     */
    const existingDoc = this.db.findDuplicateDoc(zoneSlug, versionNo, doc.permalink, jsonPath)
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
    await fs.outputJSON(this.paths.docPath(zoneSlug, versionNo, jsonPath), doc.content)

    /**
     * Add to db
     */
    this.db.addDoc(zoneSlug, versionNo, metaData)
  }

  /**
   * Syncs zones with the db. Also versions will inside zones will
   * be synced automatically.
   *
   * @method syncZones
   *
   * @param  {Array}  zones
   *
   * @return {Object}
   */
  async syncZones (zones) {
    ow(zones, ow.array.label('zones'))

    /**
     * Get existing zones
     */
    const existingZones = this.db.getZones().map((zone) => zone)

    /**
     * Find the zones which have been removed
     */
    const removed = _.differenceBy(existingZones, zones, (zone) => zone.slug)
    await Promise.all(removed.map((zone) => {
      this.db.removeZone(zone.slug)
      return fs.remove(this.paths.zonePath(zone.slug))
    }))

    /**
     * Find the one's newly added
     */
    let added = _.differenceBy(zones, existingZones, (zone) => zone.slug)
    added = await Promise.all(added.map((zone) => {
      this.db.saveZone(_.omit(zone, ['versions']))
      return new Promise((resolve, reject) => {
        this
          .syncVersions(zone.slug, zone.versions)
          .then((versions) => {
            zone.versions = versions
            resolve(zone)
          })
          .catch(reject)
      })
    }))

    /**
     * Find the one's updated
     */
    let updated = zones.filter((zone) => {
      return !added.find((az) => az.slug === zone.slug) && !removed.find((rz) => rz.slug === zone.slug)
    })
    updated = await Promise.all(updated.map((zone) => {
      this.db.saveZone(_.omit(zone, ['versions']))
      return new Promise((resolve, reject) => {
        this
          .syncVersions(zone.slug, zone.versions)
          .then((versions) => {
            zone.versions = versions
            resolve(zone)
          })
          .catch(reject)
      })
    }))

    return { removed, added, updated }
  }

  /**
   * Syncs all the versions to the db
   *
   * @method syncVersions
   *
   * @param  {String}    zoneSlug
   * @param  {Array}     versions
   *
   * @return {Object}
   */
  async syncVersions (zoneSlug, versions) {
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versions, ow.array.label('versions'))

    /**
     * Normalize versions by remove docs props (if any)
     */
    versions = versions.map((version) => _.omit(version, ['docs']))

    /**
     * An array of versions that already exists in the database
     */
    const existingVersions = (this.db.getVersions(zoneSlug) || []).map((version) => _.omit(version, ['docs']))

    /**
     * An array of versions removed in the new set of versions we have received
     */
    const removed = _.differenceBy(existingVersions, versions, (version) => version.no)

    /**
     * Remove versions and their docs for the one's which are
     * removed.
     */
    await Promise.all([removed.map((version) => {
      this.db.removeVersion(zoneSlug, version.no)
      return fs.remove(this.paths.versionPath(zoneSlug, version.no))
    })])

    /**
     * Find the added ones and save them to the db
     */
    const added = _.differenceWith(versions, existingVersions, (source, other) => {
      return source.no === other.no && source.location === other.location
    }).map((version) => {
      return _.omit(this.db.saveVersion(zoneSlug, version), ['docs'])
    })

    /**
     * Find the updated ones and update them in the db
     */
    const updated = versions.filter((version) => {
      return !added.find((av) => av.no === version.no) && !removed.find((rv) => rv.no === version.no)
    }).map((version) => {
      return _.omit(this.db.saveVersion(zoneSlug, version), ['docs'])
    })

    return { added, removed, updated }
  }

  /**
   * Remove doc using it's path for a given version
   *
   * @method removeDoc
   *
   * @param  {String}  zoneSlug
   * @param  {String}  versionNo
   * @param  {String}  filePath
   *
   * @return {void}
   */
  async removeDoc (zoneSlug, versionNo, filePath) {
    /**
     * Validations
     */
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)

    const jsonPath = this.paths.makeJsonPath(filePath)

    /**
     * Drop the actual content file from disk
     */
    await fs.remove(join(this.paths.versionPath(zoneSlug, versionNo), jsonPath))

    /**
     * Update db
     */
    this.db.removeDoc(zoneSlug, versionNo, jsonPath)
  }

  /**
   * Returns an array of versions
   *
   * @method getVersions
   *
   * @param {String} zoneSlug
   *
   * @return {Array|Null}
   */
  getVersions (zoneSlug) {
    const versions = this.db.getVersions(zoneSlug)
    if (!versions) {
      return null
    }

    return versions.map((version) => {
      version.heroDoc = this.db.getVersion(zoneSlug, version.no).docs[0] || null
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
   * @param  {String}    zoneSlug
   * @param  {String}    versionNo
   * @param  {Object}    doc
   * @param  {Boolean}   [attachVersion = false]
   *
   * @return {Object}
   */
  async loadContent (zoneSlug, versionNo, doc, attachVersion = false) {
    /**
     * Validations
     */
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(doc, ow.object.label('doc').hasKeys('jsonPath'))
    ow(doc.jsonPath, ow.string.label('doc.jsonPath').nonEmpty)

    const content = await fs.readJSON(this.paths.docPath(zoneSlug, versionNo, doc.jsonPath))
    const finalDoc = _.omit(Object.assign({ content }, doc), 'jsonPath')

    /**
     * Attach the version node to the doc, when request for it
     */
    if (attachVersion) {
      finalDoc.version = _.omit(this.db.getVersion(zoneSlug, versionNo), 'docs')
    }

    return finalDoc
  }

  /**
   * Returns an array of docs nested under categories
   *
   * @method getTree
   *
   * @param  {String}  zoneSlug
   * @param  {String}  versionNo
   * @param  {Boolean} [limit = 0]
   * @param  {Boolean} [withContent = false]
   * @param  {Boolean} [attachVersion = false]
   *
   * @return {Array|Null}
   */
  async getTree (zoneSlug, versionNo, limit = 0, withContent = false, attachVersion = false) {
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)

    /**
     * If version doesn't exists, return null. This is to
     * differentiate between non-existing version and
     * version with no docs.
     */
    const version = this.db.getVersion(zoneSlug, versionNo)
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
      docs = await Promise.all(docs.map((doc) => this.loadContent(zoneSlug, versionNo, doc, attachVersion)))
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
   * @param  {String}  zoneSlug
   * @param  {String}  versionNo
   * @param  {String}  filePath
   * @param  {Boolean} attachVersion
   *
   * @return {Object}
   */
  async getDoc (zoneSlug, versionNo, filePath, attachVersion) {
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(filePath, ow.string.label('filePath').nonEmpty)

    const doc = this.db.getDoc(zoneSlug, versionNo, this.paths.makeJsonPath(filePath))

    /**
     * Return null if doc is missing
     */
    if (!doc) {
      return null
    }

    return this.loadContent(zoneSlug, versionNo, doc, attachVersion)
  }

  /**
   * Return doc by permalink
   *
   * @method getDocByPermalink
   *
   * @param  {String}     zoneSlug
   * @param  {String}     versionNo
   * @param  {String}     permalink
   * @param  {Boolean}    [attachVersion = false]
   *
   * @return {Object}
   */
  async getDocByPermalink (zoneSlug, versionNo, permalink, attachVersion = false) {
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(permalink, ow.string.label('permalink').nonEmpty)

    const doc = this.db.getDocByPermalink(zoneSlug, versionNo, permalink)

    /**
     * Return null if doc is missing
     */
    if (!doc) {
      return null
    }

    return this.loadContent(zoneSlug, versionNo, doc, attachVersion)
  }

  /**
   * Returns the permalink at which the doc must be redirected. If
   * there are no redirects then `null` is returned
   *
   * @method redirectedPermalink
   *
   * @param  {String}            zoneSlug
   * @param  {String}            versionNo
   * @param  {String}            permalink
   *
   * @return {String|Null}
   */
  redirectedPermalink (zoneSlug, versionNo, permalink) {
    /**
     * Validations
     */
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(permalink, ow.string.label('permalink').nonEmpty)

    /**
     * Return null if version is missing
     */
    const version = this.db.getVersion(zoneSlug, versionNo)
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
    return _.omit(this.db.data, ['zones', 'compilerOptions'])
  }

  /**
   * Creates a search index for a given version
   *
   * @method indexVersion
   *
   * @param  {String}     zoneSlug
   * @param  {String}     versionNo
   *
   * @return {void}
   */
  async indexVersion (zoneSlug, versionNo) {
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)

    const index = new Index(this.paths.searchIndexFile(zoneSlug, versionNo))

    /**
     * Get the entire tree with the loaded content
     */
    const tree = await this.getTree(zoneSlug, versionNo, 0, true)

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
   * @param  {String} zoneSlug
   * @param  {String} versionNo
   * @param  {String} term
   * @param  {String} limit
   *
   * @return {Array}
   */
  async search (zoneSlug, versionNo, term, limit) {
    ow(zoneSlug, ow.string.label('zoneSlug').nonEmpty)
    ow(versionNo, ow.string.label('versionNo').nonEmpty)
    ow(versionNo, ow.string.label('term').nonEmpty)

    return Search.search(this.paths.searchIndexFile(zoneSlug, versionNo), term, limit)
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
      await fs.remove(this.paths.apiPath())
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
