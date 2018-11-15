/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join, extname } from 'path'
import { outputJson, remove } from 'fs-extra'
import ow from 'ow'

import { IDocNode, IConfigVersion, IConfigZone } from '../Contracts'
import { Context } from '../Context'
import { MissingPath, DuplicatePermalink, FrozenVersion, DuplicateSource } from '../Exceptions'

import debug from '../../utils/debug'

/**
 * This type is returned when `toJSON` is called to the
 * version
 */
type IVersionJSON = {
  no: string,
  name: string,
  location: string,
  docs: { [jsonPath: string]: Partial<IDocNode> },
}

/**
 * Version class manages the lifecycle of docs for a given version. It allows
 * all read and write operations to deal with the docs of a single version.
 */
export class Version {
  public docs: { [jsonPath: string]: Partial<IDocNode> } = {}
  public isFrozen: boolean = false

  constructor (
    public no: string,
    public docsPath: string,
    private _ctx: Context,
    public zone: Pick<IConfigZone, 'name' | 'slug'>,
    public name?: string,
  ) {
    debug('new version %s', this.uid)
    this.name = this.name || this.no
  }

  /**
   * Unique id for the version. Generated using `zone/versionNo`.
   */
  public get uid () {
    return `${this.zone.slug}/${this.no}`
  }

  /**
   * Returns the base path for storing docs
   */
  private _getBasePath () {
    const dest = this._ctx.getPath('dest')
    if (!dest) {
      throw MissingPath.dest()
    }

    return join(dest, this.uid)
  }

  /**
   * Scan existing docs for duplicate permalink
   */
  private _scanForDuplicates (permalink: string, jsonPath: string) {
    const duplicatePath = Object.keys(this.docs).find((docPath) => {
      return docPath !== jsonPath && this.docs[docPath].permalink === permalink
    })

    if (!duplicatePath) {
      return
    }

    throw DuplicatePermalink.invoke(join(this.docsPath, this.docs[duplicatePath].srcPath!))
  }

  /**
   * Scans the existing doc, where the `srcPath` are different. However the
   * jsonPath yields to same. Which means the src has different extension
   * and will override the destination.
   */
  private _scanForOverrides (srcPath: string, jsonPath: string) {
    const duplicateSrcPath = Object.keys(this.docs).find((docPath) => {
      return docPath === jsonPath && this.docs[docPath].srcPath !== srcPath
    })

    if (!duplicateSrcPath) {
      return
    }

    throw DuplicateSource.invoke(
      join(this.docsPath, this.docs[duplicateSrcPath].srcPath!),
      join(this.docsPath, srcPath),
    )
  }

  /**
   * Makes the json path for a given doc
   */
  private _makeJsonPath (filePath: string): string {
    return join(this._getBasePath(), filePath.replace(extname(filePath), '.json'))
  }

  /**
   * Raises error if `isFrozen` is set to true. This method is used internally
   * to avoid changes to versions that have been removed.
   *
   * The changes will only occur, when some part of the code is holding a reference
   * to a deleted version, causing memory leaks.
   */
  private _ensureIsntFrozen () {
    if (this.isFrozen) {
      throw FrozenVersion.invoke()
    }
  }

  /**
   * Update version name of location by sending the IConfigVersion
   * node
   */
  public update (version: Partial<IConfigVersion>): void {
    this._ensureIsntFrozen()

    if (version.name) {
      debug('updating version name %s', version.name)
      this.name = version.name
    }

    if (version.location) {
      debug('updating version location %s', version.location)
      this.docsPath = version.location
    }
  }

  /**
   * Saves the doc contents on the disk and keep a copy of doc meta data
   * to build the data store.
   *
   * This method will raise error in following conditions.
   *
   * 1. If `dest` path is not registered with the context.
   * 2. The `permalink` is in use already. Since permalinks must be unique
   */
  public async saveDoc (filePath: string, doc: IDocNode): Promise<Error | void> {
    ow(doc.permalink, ow.string.label('doc.permalink').nonEmpty)
    ow(doc.title, ow.string.label('doc.title').nonEmpty)
    ow(doc.content, ow.object.label('doc.title').hasKeys('type', 'children'))

    /**
     * Ensure version isn't frozen already
     */
    this._ensureIsntFrozen()
    const jsonPath = this._makeJsonPath(filePath)

    /**
     * Scan for source files which will override each other, since
     * the src extension is different
     */
    this._scanForOverrides(filePath, jsonPath)

    /**
     * Raises error when permalink is used by any other doc. This also means that all
     * docs must be saved sequentially and not parallely.
     */
    this._scanForDuplicates(doc.permalink, jsonPath)

    /**
     * Store a reference for saving meta data. Ideally we just want to omit
     * content and normalize some fields and have different reference in
     * memory.
     */
    this.docs[jsonPath] = {
      title: doc.title,
      srcPath: filePath,
      permalink: doc.permalink,
      toc: doc.toc,
    }

    debug('saving doc %s', jsonPath)
    await outputJson(jsonPath, doc.content)
  }

  /**
   * Removes the doc from the disk and update it's in-memory
   * reference
   */
  public async removeDoc (filePath: string) {
    this._ensureIsntFrozen()

    const jsonPath = this._makeJsonPath(filePath)
    debug('removing doc %s', jsonPath)

    delete this.docs[jsonPath]
    await remove(jsonPath)
  }

  /**
   * Cleans the version docs from the disk and marks the version as
   * frozen. Which means, write operations cannot be performed on
   * this version.
   */
  public async clean () {
    debug('removing version %s', this.uid)

    /**
     * Freeze for future mutations
     */
    this.isFrozen = true

    /**
     * Free memory
     */
    this.docs = {}

    await remove(this._getBasePath())
  }

  /**
   * Returns the version node as an JSON object, which can
   * be writing to disk using `JSON.stringify`.
   */
  public toJSON (): IVersionJSON {
    return {
      no: this.no,
      name: this.name!,
      location: this.docsPath,
      docs: this.docs,
    }
  }
}
