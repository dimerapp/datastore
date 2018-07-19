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
const elasticlunr = require('elasticlunr')
const toString = require('mdast-util-to-string')

class Search {
  constructor (indexPath) {
    this.indexPath = indexPath
    this.blackListedBlockTags = ['pre']
    this.blackListedClasses = ['dimer-highlight', 'toc-container']
    this.headings = ['h2', 'h3', 'h4']

    /**
     * Each child of ul is seperated by a space
     */
    this.spacer = {
      'ul': ' ',
      'ol': ' '
    }

    /**
     * The index used to build the index
     */
    this.writeIndex = elasticlunr(function () {
      this.addField('title')
      this.addField('body')
      this.setRef('url')
    })

    /**
     * The read index for search
     */
    this.readIndex = null
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

    const sections = []
    let section = null

    content.children
      .map((child) => {
        if (this._isHeading(child)) {
          section = { title: toString(child), body: [], url: `${permalink}${child.children[0].props.href}` }
          sections.push(section)
          return
        }

        if (section) {
          section.body.push(this._nodeToString(child))
        }
      })

    sections.forEach((section) => {
      this.writeIndex.addDoc({ title: section.title, body: section.body.join(''), url: section.url })
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
    await fs.outputJSON(this.indexPath, this.writeIndex.toJSON())
  }

  /**
   * Load the index for search
   *
   * @method load
   *
   * @return {void}
   */
  async load () {
    try {
      const indexJSON = await fs.readJSON(this.indexPath)
      this.readIndex = elasticlunr.Index.load(indexJSON)
    } catch (error) {
    }
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
  search (term) {
    if (!this.readIndex) {
      throw new Error('Make sure to all search.readIndex, before initiating a search')
    }

    return this.readIndex.search(term, {
      fields: {
        title: {
          boost: 2
        },
        body: {
          boost: 1
        }
      }
    })
  }
}

module.exports = Search
