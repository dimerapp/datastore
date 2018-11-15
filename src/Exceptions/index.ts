/*
 * database
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

export class ConfigNotFound extends Error {
  public ruleId: string

  public static invoke () {
    const error = new this('Not a dimer project. Make sure to run dimer init or create dimer.json manually')
    error.ruleId = 'missing-config-file'
    return error
  }
}

export class MissingAppRootPath extends Error {
  public ruleId: string

  public static invoke (consumer) {
    const error = new this(`Make sure to define the appRoot path before instantiating the ${consumer}`)
    error.ruleId = 'internal-error'
    return error
  }
}

export class MissingDestPath extends Error {
  public ruleId: string

  public static invoke () {
    const error = new this('Cannot save docs, without defining the dest path inside context')
    error.ruleId = 'internal-error'
    return error
  }
}

export class DuplicatePermalink extends Error {
  public ruleId: string

  public static invoke (docPath) {
    const error = new this(`Duplicate permalink used by ${docPath}`)
    error.ruleId = 'duplicate-permalink'
    return error
  }
}

export class DuplicateSource extends Error {
  public ruleId: string

  public static invoke (oldSrc, newSrc) {
    const error = new this(`${newSrc} and ${oldSrc} are potentially same`)
    error.ruleId = 'duplicate-src-path'
    return error
  }
}

export class FrozenVersion extends Error {
  public ruleId: string

  public static invoke () {
    const error = new this('Cannot modify deleted version')
    error.ruleId = 'internal-error'
    return error
  }
}

export class MissingVersionDir extends Error {
  public ruleId: string

  public static invoke (location, versionNo) {
    const error = new this(`Unable to find directory ${location} referenced by ${versionNo}`)
    error.ruleId = 'missing-version-location'
    return error
  }
}
