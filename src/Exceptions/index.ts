/*
 * database
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

export class FileNotFound extends Error {
  public ruleId: string

  /**
   * Raised when `dimer.json` is missing in the
   * project root
   */
  public static missingConfigFile () {
    const error = new this('Not a dimer project. Make sure to run dimer init or create dimer.json manually')
    error.ruleId = 'missing-config-file'
    return error
  }

  /**
   * Raised when translation file mapped to the language inside
   * `dimer.json` is missing.
   */
  public static translationNotFound (lang: string, file: string) {
    const error = new this(`Translation file ${file} missing for ${lang}`)
    error.ruleId = 'missing-translation-file'
    return error
  }
}

export class MissingPath extends Error {
  public ruleId: string

  /**
   * Raised when `appRoot` is missing inside the context. This
   * is mainly a programming error
   */
  public static appRoot (consumer) {
    const error = new this(`Make sure to define the appRoot path before instantiating the ${consumer}`)
    error.ruleId = 'internal-error'
    return error
  }

  /**
   * Raised when `dest` is missing inside the context. This
   * is mainly a programming error
   */
  public static dest () {
    const error = new this('Cannot persist datastore without the dest path inside context')
    error.ruleId = 'internal-error'
    return error
  }

  /**
   * Raised when location defined inside the config file for a given version is
   * missing
   */
  public static versionDir (location, versionNo) {
    const error = new this(`Unable to find directory ${location} referenced by ${versionNo}`)
    error.ruleId = 'missing-version-location'
    return error
  }
}

export class DuplicatePermalink extends Error {
  public ruleId: string

  /**
   * Raised when permalink is also used by a different doc for the
   * same version
   */
  public static invoke (docPath) {
    const error = new this(`Duplicate permalink used by ${docPath}`)
    error.ruleId = 'duplicate-permalink'
    return error
  }
}

export class DuplicateSource extends Error {
  public ruleId: string

  /**
   * Raised when source file jsonPath will yield to a duplicate file.
   * This happens when source file has different markdown extensions
   * but the same name.
   */
  public static invoke (oldSrc, newSrc) {
    const error = new this(`${newSrc} and ${oldSrc} are potentially same`)
    error.ruleId = 'duplicate-src-path'
    return error
  }
}

export class FrozenVersion extends Error {
  public ruleId: string

  /**
   * Raised when trying to mutate the frozen version
   */
  public static invoke () {
    const error = new this('Cannot modify deleted version')
    error.ruleId = 'internal-error'
    return error
  }
}
