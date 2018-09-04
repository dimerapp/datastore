/*
* md-serve
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const ow = require('ow')
const fs = require('fs-extra')
const toString = require('mdast-util-to-string')
const lunr = require('lunr')
const _ = require('lodash')

/**
 * Creates a search index for all the docs
 *
 * @class Search
 *
 * @param {String} indexPath
 */
class Index {
  constructor (indexPath) {
    this.indexPath = indexPath
    this.blackListedBlockTags = ['pre', 'html', 'image', 'imageReference', 'linkReference', 'th']
    this.blackListedClasses = ['dimer-highlight', 'toc-container']
    this.headings = ['h1', 'h2', 'h3', 'h4']

    /**
     * Each child of ul is seperated by a space
     */
    this.spacer = {
      'ul': ' ',
      'ol': ' '
    }

    /**
     * Docs to be written to the disk
     *
     * @type {Array}
     */
    this.docs = {}
  }

  /**
   * Returns a boolean if node is white-listed to the index
   *
   * @method _isWhiteListed
   *
   * @param  {String}      options.tag
   * @param  {Object}      options.props
   *
   * @return {Boolean}
   *
   * @private
   */
  _isWhiteListed ({ tag, props }) {
    return this.blackListedBlockTags.indexOf(tag) === -1 && _.every(props.className, (className) => {
      return !_.includes(this.blackListedClasses, className)
    })
  }

  /**
   * Returns a boolean telling if node is a heading
   *
   * @method _isHeading
   *
   * @param  {String}  options.tag
   *
   * @return {Boolean}
   *
   * @private
   */
  _isHeading ({ tag }) {
    return this.headings.indexOf(tag) > -1
  }

  /**
   * Returns the string representation of a given node and
   * it's child. Also filters for blackListed nodes
   *
   * @method _nodeToString
   *
   * @param  {Object}     node
   *
   * @return {Array}
   *
   * @private
   */
  _nodeToString (node) {
    if (node.type !== 'element') {
      return [toString(node)]
    }

    /**
     * Return if node is not white listed
     */
    if (!this._isWhiteListed(node)) {
      return []
    }

    /**
     * For the paragraph, we make everything into a big string
     */
    if (node.tag === 'p') {
      const parsed = toString(node)
      return parsed.length ? [parsed] : []
    }

    /**
     * For each tr, we ignore the {TH's} and process
     * the {TD's} as one space seperated string.
     */
    if (node.tag === 'tr') {
      return node.children.reduce((result, item) => {
        if (!this._isWhiteListed(item)) {
          return result
        }

        const parsed = toString(item)
        if (parsed.length) {
          result = result.concat(parsed)
        }

        return result
      }, []).join(' ')
    }

    /**
     * For everything else, we just loop over the children
     * and convert them one by one.
     */
    return node.children.reduce((result, item) => {
      const parsed = this._nodeToString(item)
      if (parsed.length) {
        result = result.concat(parsed)
      }
      return result
    }, [])
  }

  /**
   * Save a new doc to the index. All headings will be sectionized
   * into search index
   *
   * @method addDoc
   *
   * @param  {Object} content
   * @param  {String} permalink
   */
  addDoc (content, permalink) {
    ow(content, ow.object.label('content').hasKeys('children'))
    ow(content.children, ow.array.label('content.children').nonEmpty)
    ow(permalink, ow.string.label('permalink').nonEmpty)

    let sectionUrl = null

    content.children
      .map((child) => {
        if (this._isHeading(child)) {
          sectionUrl = child.tag === 'h1' ? permalink : `${permalink}${child.children[0].props.href}`
          this.docs[sectionUrl] = { title: toString(child), nodes: [], url: sectionUrl }
          return
        }

        if (sectionUrl && this.docs[sectionUrl]) {
          const parsed = this._nodeToString(child)
          if (parsed.length) {
            this.docs[sectionUrl].nodes = this.docs[sectionUrl].nodes.concat(parsed)
          }
        }
      })
  }

  /**
   * Write search index file to the disk
   *
   * @method save
   *
   * @return {void}
   */
  async save () {
    const self = this

    const index = lunr(function () {
      this.ref('url')
      this.field('content', { boost: 2 })
      this.metadataWhitelist = ['position']

      _.each(self.docs, (doc) => {
        /**
         * The title will be first item for that doc
         */
        this.add({
          url: `${doc.url}@lvl0`,
          content: doc.title
        })

        /**
         * Then we save each node
         */
        _.each(doc.nodes, (content, index) => {
          this.add({
            url: `${doc.url}@lvl${index + 1}`,
            content: content
          })
        })
      })
    })

    await fs.outputJSON(this.indexPath, {
      index: index.toJSON(),
      docs: this.docs
    })
  }
}

module.exports = Index
