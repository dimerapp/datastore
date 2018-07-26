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

class Search {
  constructor () {
    this.indexesCache = {}
  }

  get paths () {
    return Object.keys(this.indexesCache)
  }

  /**
   * Clear the cache
   *
   * @method clear
   *
   * @return {void}
   */
  clear () {
    this.indexesCache = {}
  }

  /**
   * Remove a given index path from the cache
   *
   * @method removeFromCache
   *
   * @param  {String}        indexPath
   *
   * @return {void}
   */
  removeFromCache (indexPath) {
    delete this.indexesCache[indexPath]
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

      this.indexesCache[indexPath] = {
        docs: indexJSON.docs,
        index: lunr.Index.load(indexJSON.index),
        mtime
      }
    } catch (error) {
    }
  }

  /**
   * Load the index for search
   *
   * @method load
   *
   * @return {void}
   */
  async load (indexPath) {
    const stats = await fs.stat(indexPath)
    const cached = this.indexesCache[indexPath]
    const lastWriteTime = stats.mtime.toISOString()

    if (!cached || new Date(lastWriteTime) > new Date(cached.mtime)) {
      await this.loadIndex(indexPath, lastWriteTime)
    }

    return this.indexesCache[indexPath]
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
