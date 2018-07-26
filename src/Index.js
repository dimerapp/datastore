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
    this.blackListedBlockTags = ['pre']
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
    return this.blackListedBlockTags.indexOf(tag) === -1 && this.blackListedClasses.indexOf(props.className) === -1
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
   * @return {String}
   *
   * @private
   */
  _nodeToString (node) {
    if (node.type === 'element') {
      if (this._isWhiteListed(node)) {
        return node.children.map((n) => this._nodeToString(n)).join(this.spacer[node.tag] || '')
      }
      return ''
    }

    return toString(node)
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
          this.docs[sectionUrl] = { title: toString(child), body: '', url: sectionUrl }
          return
        }

        if (sectionUrl && this.docs[sectionUrl]) {
          this.docs[sectionUrl].body += this._nodeToString(child)
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
      this.field('title', { boost: 2 })
      this.field('body', { boost: 1 })
      this.metadataWhitelist = ['position']

      _.each(self.docs, (doc) => (this.add(doc)))
    })

    await fs.outputJSON(this.indexPath, {
      index: index.toJSON(),
      docs: this.docs
    })
  }
}

module.exports = Index
