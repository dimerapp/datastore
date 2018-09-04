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
const _ = require('lodash')

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
   * Loops over the search results position meta data and converts
   * them into a flat array of positions
   *
   * @method _collectPositions
   *
   * @param  {Object}          node
   *
   * @return {Object}
   *
   * @private
   */
  _collectPositions (metadata) {
    return _.reduce(metadata, (result, keyword) => {
      if (keyword.content) {
        result = result.concat(keyword.content.position)
      }
      return result
    }, [])
  }

  /**
   * Converts an array of positions to an array of marks by
   * reading the substring from text
   *
   * @method _positionToMarks
   *
   * @param  {Array}         positions
   * @param  {String}         text
   *
   * @return {Array}
   *
   * @private
   */
  _positionToMarks (positions, text) {
    /**
     * Return a single node when text is empty
     */
    if (!text || !positions || !positions.length) {
      return [{ type: 'raw', text }]
    }

    let lastIndex = 0
    const marks = _.reduce(positions, (tokens, [start, end]) => {
      /**
       * First token will be raw
       */
      const raw = text.substr(lastIndex, start - lastIndex)
      tokens.push({ text: raw, type: 'raw' })

      /**
       * Next will be the mark
       */
      const mark = text.substr(start, end)
      tokens.push({ text: mark, type: 'mark' })

      /**
       * Update last index from start from the correct order
       */
      lastIndex = start + end

      return tokens
    }, [])

    /**
     * If last index is smaller than the text length, use all
     * remaining text as raw node
     */
    if (lastIndex < text.length) {
      marks.push({ type: 'raw', text: text.substring(lastIndex, text.length) })
    }

    return marks
  }

  /**
   * Convert each search node into a node with marks
   *
   * @method _nodeToMarks
   *
   * @return {Object}
   *
   * @private
   */
  _nodeToMarks (score, metadata, content) {
    const positions = metadata ? this._collectPositions(metadata) : []

    return {
      score,
      marks: this._positionToMarks(positions, content)
    }
  }

  /**
   * Returns the url and the nodeIndex for a given ref
   *
   * @method _getUrlAndNodeIndex
   *
   * @param  {String}            ref
   *
   * @return {Object}
   *
   * @private
   */
  _getUrlAndNodeIndex (ref) {
    const [url, nodeIndex] = ref.split('@lvl')
    return { url, nodeIndex: Number(nodeIndex) }
  }

  /**
   * Returns the attributes node
   *
   * @method _getAttributeNode
   *
   * @param  {Number}          score
   *
   * @return {Object}
   */
  _getAttributeNode (score) {
    return {
      score,
      marks: []
    }
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
   * @param  {String}  size
   *
   * @return {void}
   */
  async loadIndex (indexPath, mtime, size) {
    try {
      const indexJSON = await fs.readJSON(indexPath)
      if (!indexJSON.docs || !indexJSON.index) {
        throw new Error('Invalid index')
      }

      this.indexesCache.set(indexPath, {
        docs: indexJSON.docs,
        index: lunr.Index.load(indexJSON.index),
        mtime,
        size
      })
    } catch (error) {
    }
  }

  /**
   * Returns the mtime for a given file on the disk
   *
   * @method getStats
   *
   * @param  {String} filePath
   *
   * @return {Number|String}
   */
  async getStats (filePath) {
    try {
      const stats = await fs.stat(filePath)
      return { mtime: stats.mtime.getTime(), size: stats.size }
    } catch (error) {
      return { mtime: 0, size: 0 }
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
    const { mtime } = await this.getStats(filePath)
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
    const { mtime: lastWriteTime, size } = await this.getStats(indexPath)

    if (!cached || (lastWriteTime > cached.mtime || size !== cached.size)) {
      await this.loadIndex(indexPath, lastWriteTime, size)
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
  async search (indexPath, term, limit = 0) {
    const index = await this.load(indexPath)

    /**
     * Lazily revalidate the cache to drop invalid indexes
     * cache.
     */
    this.revalidate()

    /**
     * Invlid content inside the index file
     */
    if (!index || !index.index || !index.docs) {
      return []
    }

    /**
     * Some real shit happens here.
     *
     * The results returned by lunrjs is flat. However, we have nested documents inside
     * each title. So we simply have to re-nest them.
     */
    const queryResults = _.transform(index.index.search(term), (result, node, key) => {
      if (limit && key === limit) {
        return false
      }

      const { url, nodeIndex } = this._getUrlAndNodeIndex(node.ref)
      if (!result[url] && index.docs[url]) {
        result[url] = {
          doc: index.docs[url],
          title: { score: 0, metadata: null, index: -1 },
          matchData: []
        }
      }

      if (result[url]) {
        if (nodeIndex === 0) {
          result[url].title = {
            index: nodeIndex,
            score: node.score,
            metadata: node.matchData.metadata
          }
        } else {
          result[url].matchData.push({
            index: nodeIndex - 1,
            score: node.score,
            metadata: node.matchData.metadata
          })
        }
      }

      return result
    }, {})

    /**
     * Here we process the nested documents and add highlighting marks to them.
     */
    return _.reduce(queryResults, (result, node) => {
      result.push({
        url: node.doc.url,
        title: this._nodeToMarks(node.title.score, node.title.metadata, node.doc.title),
        body: _.map(node.matchData, ({ score, index, metadata }) => {
          return this._nodeToMarks(score, metadata, node.doc.nodes[index])
        })
      })

      return result
    }, [])
  }
}

module.exports = new Search()
