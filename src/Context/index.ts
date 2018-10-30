/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { isAbsolute } from 'path'

/**
 * Context is a simple class to store project wide configuration
 * and pass it around to multiple classes vs passing handful
 * of options manually.
 */
export class Context {
  public paths: { [key: string]: string } = {}

  /**
   * Add absolute path and associate it with a key for later
   * use
   */
  public addPath (key: string, location: string): void {
    if (!isAbsolute(location)) {
      throw new Error('ctx.addPath only allows absolute paths')
    }

    this.paths[key] = location
  }

  /**
   * Get absolute path for a given key
   */
  public getPath (key: string): string | undefined {
    return this.paths[key]
  }
}
