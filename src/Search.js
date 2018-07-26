/*
* datastore
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const fs = require('fs-extra')
const lunr = require('lunr')

/**
 * Search by loading the pre-build indexes
 *
 * @class Search
 */
class Search {
  constructor () {
    this.indexesCache = new Map()
  }

  /**
   * Returns an array of paths in cache
   *
   * @method paths
   *
   * @return {Array}
   */
  get paths () {
    return Array.from(this.indexesCache.keys())
  }

  /**
   * Clears the cache
   *
   * @method clearCache
   *
   * @return {void}
   */
  clearCache () {
    this.indexesCache = new Map()
  }

  /**
   * Load a index from the disk to lunr. After loading
   * the indexesCache will be populated with the
   * data
   *
   * @method loadIndex
   *
   * @param  {String}  indexPath
   * @param  {String}  mtime
   *
   * @return {void}
   */
  async loadIndex (indexPath, mtime) {
    try {
      const indexJSON = await fs.readJSON(indexPath)
      if (!indexJSON.docs || !indexJSON.index) {
        throw new Error('Invalid index')
      }

      this.indexesCache.set(indexPath, {
        docs: indexJSON.docs,
        index: lunr.Index.load(indexJSON.index),
        mtime
      })
    } catch (error) {
    }
  }

  /**
   * Returns the mtime for a given file on the disk
   *
   * @method getMTime
   *
   * @param  {String} filePath
   *
   * @return {Number|String}
   */
  async getMTime (filePath) {
    try {
      const stats = await fs.stat(filePath)
      return stats.mtimeMs
    } catch (error) {
      return 0
    }
  }

  /**
   * Revalidate the index path by making sure it
   * exists on the disk, otherwise removed
   * from the cache too
   *
   * @method revalidateIndex
   *
   * @param  {String}        filePath
   *
   * @return {void}
   */
  async revalidateIndex (filePath) {
    const mtime = await this.getMTime(filePath)
    if (mtime === 0) {
      this.indexesCache.delete(filePath)
    }
  }

  /**
   * Revalidate the indexes cache, if the index file is removed
   * from the disk, then we will drop the cache too
   *
   * @method revalidate
   *
   * @return {Promise}
   */
  revalidate () {
    return Promise.all(this.paths.map((cachePath) => this.revalidateIndex(cachePath)))
  }

  /**
   * Load the index for search
   *
   * @method load
   *
   * @return {void}
   */
  async load (indexPath) {
    const cached = this.indexesCache.get(indexPath)
    const lastWriteTime = await this.getMTime(indexPath)

    if (!cached || lastWriteTime > cached.mtime) {
      await this.loadIndex(indexPath, lastWriteTime)
    }

    return this.indexesCache.get(indexPath)
  }

  /**
   * Make search for a given term
   *
   * @method search
   *
   * @param  {String} term
   *
   * @return {void}
   */
  async search (indexPath, term) {
    const { docs, index } = await this.load(indexPath)

    /**
     * Lazily revalidate the cache to drop invalid indexes
     * cache.
     */
    this.revalidate()

    const result = index.search(term)

    /**
     * Attach doc to the results node
     */
    return result.map((node) => {
      node.doc = docs[node.ref] || {}
      return node
    })
  }
}

module.exports = new Search()
