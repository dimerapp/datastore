/**
 * database
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import * as vFile from 'vfile'
import * as fs from 'fs-extra'
import * as grayMatter from 'gray-matter'
import * as Markdown from '@dimerapp/markdown'
import * as utils from '@dimerapp/utils'
import { basename } from 'path'

import { IMarkdownOptions, IFileErrorMessage } from '../Contracts'

/**
 * File represents a single markdown file on the disk. Calling `parse`
 * on this class will read the file and convert it to JSON.
 *
 * The `errors` and `warnings` array can be accessed to find if file has
 * any errors or not.
 *
 * ```js
 * const file = new File(filePath, relativePath, {})
 * await file.parse()
 *
 * if (file.enoent) {
 *   // file doesn't exists
 * }
 *
 * if (file.errors.length > 0) {
 *   // Has errors: DO NOT SAVE
 * }
 *
 * if (file.warnings) {
 *   // Has warnings: SAVE AND SHOW THEM TO THE USER
 * }
 * ```
 *
 * To report the errors or warnings from outside you can make use of following methods.
 *
 * ```
 * file.reportError(message, ruleId)
 * file.reportWarning(message, ruleId)
 * ```
 */
export class File {
  private _vfile = vFile({ path: this.path, contents: '' })
  public enoent: boolean = false
  public metaData: any = {}

  constructor (public path: string, public relativePath: string, private _options: IMarkdownOptions) {
  }

  /**
   * Extract the title from the Markdown json or returns
   * an empty string if title is missing
   */
  private _extractTitle (contents): string {
    const node = contents.children.find((child) => child.tag === 'dimertitle')
    return node ? node.children[0].value : ''
  }

  /**
   * Returns the permalink by making it from the file name
   */
  private _makePermalink () {
    return utils.permalink.generateFromFileName(basename(this.relativePath))
  }

  /**
   * Validate the permalink and report as fatal error if is
   * invalid
   */
  private _validatePermalink (permalink): boolean {
    try {
      utils.permalink.validate(permalink)
      return true
    } catch (error) {
      this.reportError(error.message, error.ruleId)
      return false
    }
  }

  /**
   * Reads the file contents and swallows the error if file
   * is missing and set `enoent=true`.
   *
   * Ideally a file must always exists, since we walk through the
   * directory structure to get file paths.
   */
  private async _readFile (): Promise<string> {
    try {
      return await fs.readFile(this.path, 'utf-8')
    } catch (error) {
      this.enoent = true
      return ''
    }
  }

  /**
   * Patches the markdown content by creating white space for yaml
   * front matter. This is required to make sure that the markdown
   * parser reports the errors on correct line.
   */
  private _patchContent (content, raw, isEmpty): string {
    if (isEmpty) {
      return `${new Array(3).join('\n')}${content}`
    }

    if (!raw) {
      return content
    }

    return `${new Array(raw.split(/\r?\n/).length + 2).join('\n')}${content}`
  }

  /**
   * Parse yaml front matter as object and rest of the contents as string
   */
  private _parseYamlFrontMatter (fileContents: string): { metaData: any, content: string } {
    const { data, content, matter, isEmpty } = grayMatter(fileContents, { excerpt: false }) as any

    return {
      metaData: data,
      content: this._patchContent(content, matter, isEmpty),
    }
  }

  /**
   * Process the markdown file to JSON
   */
  private async _processMarkdown () {
    await new Markdown(this._vfile, {
      skipToc: this.metaData.toc === false,
      title: this.metaData.title,
    }, this._options).toJSON()
  }

  /**
   * Returns an array of Error messages
   */
  public get messages (): IFileErrorMessage[] {
    return this._vfile.messages
  }

  /**
   * Returns an array of warnings
   */
  public get warnings (): IFileErrorMessage[] {
    return this.messages.filter((message) => !message.fatal)
  }

  /**
   * Returns an array of errors
   */
  public get errors (): IFileErrorMessage[] {
    return this.messages.filter((message) => message.fatal)
  }

  /**
   * Returns the file contents
   */
  public get contents () {
    return this._vfile.contents
  }

  /**
   * Report a warning for the given file
   */
  public reportWarning (text: string, ruleId: string, fatal = false): this {
    const message = this._vfile.message(text, null, ruleId)
    message.relativeSource = this.relativePath
    message.fatal = fatal

    return this
  }

  /**
   * Report an error for the given file
   */
  public reportError (text: string, ruleId: string): this {
    return this.reportWarning(text, ruleId, true)
  }

  /**
   * Read the file and validate it to make sure, file is good to
   * be saved to disk
   */
  public async read () {
    const contents = await this._readFile()
    /**
     * Return if file is missing
     */
    if (this.enoent) {
      return
    }

    /**
     * Report error and return if file is empty
     */
    if (!contents.trim()) {
      this.reportError('Empty file', 'empty-file')
      return
    }

    /**
     * Parse meta data and content of the file
     */
    const { metaData, content } = this._parseYamlFrontMatter(contents)
    this._vfile.contents = content
    this.metaData = metaData

    /**
     * Set permalink on metaData if missing
     */
    if (!metaData.permalink) {
      metaData.permalink = this._makePermalink()
    }

    /**
     * Validate permalink to ensure it's correct to be used
     * as a URL. If permalink is invalid, there is no
     * need to process the file
     */
    if (!this._validatePermalink(metaData.permalink)) {
      return
    }

    /**
     * Finally process the contents of the file as Markdown. The original
     * contents will be mutated automatically.
     */
    await this._processMarkdown()

    /**
     * Compute title from the contents, if not set as metaData
     */
    if (!this.metaData.title) {
      this.metaData.title = this._extractTitle(this.contents)
    }

    /**
     * Report error if file title is missing
     */
    if (!this.metaData.title) {
      this.reportError('Missing title', 'missing-title')
    }
  }
}
