/*
* md-serve
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const _ = require('lodash')

/**
 * Find what's being changed inside an object. Nested objects are
 * not supoorted.
 *
 * @class ChangSet
 */
class ChangeSet {
  constructor (attributes) {
    this.attributes = attributes
    this.updatedAttributes = {}
  }

  /**
   * Merge new object to be tracked as changes
   *
   * @method merge
   *
   * @param  {Object} payload
   *
   * @return {void}
   */
  merge (payload) {
    Object.assign(this.updatedAttributes, payload)
  }

  /**
   * Returns an array object of what's being changed
   *
   * @attribute dirty
   *
   * @return {Object}
   */
  get dirty () {
    return _.reduce(this.updatedAttributes, (result, val, key) => {
      if (this.attributes[key] !== val) {
        result[key] = val
      }
      return result
    }, {})
  }
}

module.exports = ChangeSet
