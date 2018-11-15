/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import * as klaw from 'klaw'
import { join, extname, basename, sep } from 'path'
import { exists } from 'fs-extra'

import { MissingPath } from '../Exceptions'
import { Context } from '../Context'
import { Version } from '../Version'
import { IStatsNode } from '../Contracts'

/**
 * The Reader class is responsible for collecting all markdown
 * files for a given version.
 *
 * This class will scan the directory structure recursively and only picks the non-draft
 * markdown files.
 *
 * Here's the list of allowed extensions
 *
 * ```
 * .md
 * .markdown
 * .mdown
 * .mkd
 * .mdwn
 * .mkdown
 * .ron
 * ```
 */
export class Reader {
  private _mdExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mdwn', '.mkdown', '.ron']
  private _basePath: string = ''

  constructor (private _ctx: Context, private _version: Version) {
    if (!this._ctx.getPath('appRoot')) {
      throw MissingPath.appRoot('reader')
    }

    this._basePath = join(this._ctx.getPath('appRoot')!, this._version.docsPath)
  }

  /**
   * Returns a boolean telling if the given file must be
   * included under the markkdown files array.
   *
   * This method checks for following on the `fs.stats` object.
   *
   * 1. Is not a directory.
   * 2. Extension matches one of the markdown extension.
   * 3. File isn't a draft ending with `_`.
   */
  private _isFileAllowed (item) {
    if (item.stats.isDirectory()) {
      return false
    }

    if (this._mdExtensions.indexOf(extname(item.path)) === -1) {
      return false
    }

    return !basename(item.path).startsWith('_')
  }

  /**
   * Ensures that the version location does exists. Otherwise
   * raises an error
   */
  private async _ensureVersionLocation () {
    const hasDir = await exists(this._basePath)
    if (!hasDir) {
      throw MissingPath.versionDir(this._version.docsPath, this._version.no)
    }
  }

  /**
   * Scans the file system and collects all the markdown files
   * from the location mentioned in the config next to the
   * version.
   */
  private _scanMdFiles (): Promise<Error | IStatsNode[]> {
    return new Promise((resolve, reject) => {
      const mdFiles: IStatsNode[] = []

      klaw(join(this._ctx.getPath('appRoot')!, this._version.docsPath))
        .on('error', reject)
        .on('data', (item) => {
          if (this._isFileAllowed(item)) {
            mdFiles.push({
              absPath: item.path,
              relativePath: item.path.replace(`${this._basePath}${sep}`, ''),
            })
          }
        })
        .on('end', () => resolve(mdFiles))
    })
  }

  /**
   * Returns an array of markdown files path
   */
  public async getTree (): Promise<Error | IStatsNode[]> {
    await this._ensureVersionLocation()
    return this._scanMdFiles()
  }
}
