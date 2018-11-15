/**
 * database
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import * as test from 'japa'
import { join } from 'path'
import * as fs from 'fs-extra'
import * as dedent from 'dedent'

import { File } from '../src/File'
import { getBaseMarkdownOptions } from '../test-helpers'

const APP_ROOT = join(__dirname, 'app')

test.group('File', (group) => {
  group.afterEach(async () => {
    await fs.remove(APP_ROOT)
  })

  test('do not raise error if file is missing', async (assert) => {
    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.isTrue(file.enoent)
  })

  test('set fatal message if file is empty', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), '')

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.errors[0].message, 'Empty file')
    assert.equal(file.errors[0].ruleId, 'empty-file')
  })

  test('read file and parse its yaml front matter', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      ---
      title: Hello world
      ---
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.lengthOf(file.errors, 0)
    assert.deepEqual(file.metaData, {
      title: 'Hello world',
      permalink: 'foo',
    })
  })

  test('parse file contents to json', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      Hello world
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.deepEqual(file.contents, {
      type: 'root',
      children: [
        {
          type: 'element',
          tag: 'p',
          props: {},
          children: [{ type: 'text', value: 'Hello world' }],
        },
      ],
    })
  })

  test('report markdown errors', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      [note]
      hello
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.errors[0].message, 'Unclosed macro: note')
    assert.equal(file.errors[0].line, 1)
    assert.equal(file.errors[0].column, 1)
  })

  test('report markdown errors on correct line when using yaml front matter', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      ---
      title: Hello world
      ---

      [note]
      hello
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.errors[0].message, 'Unclosed macro: note')
    assert.equal(file.errors[0].line, 5)
    assert.equal(file.errors[0].column, 1)
  })

  test('report markdown errors on correct line when using empty yaml front matter', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      ---
      ---

      [note]
      hello
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.errors[0].message, 'Unclosed macro: note')
    assert.equal(file.errors[0].line, 4)
    assert.equal(file.errors[0].column, 1)
  })

  test('make permalink from the file name', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      Hello world
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.deepEqual(file.metaData, { permalink: 'foo', title: '' })
  })

  test('use predefined permalink over one from the file', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      ---
      permalink: foo-bar
      ---
      Hello world
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.deepEqual(file.metaData, { permalink: 'foo-bar', title: '' })
  })

  test('report errors if permalink is not safe for URL', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      ---
      permalink: foo bar
      ---
      Hello world
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.errors[0].message, 'Unallowed characters detected in permalink')
    assert.equal(file.errors[0].ruleId, 'bad-permalink')
  })

  test('report errors if title is missing', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      Hello world
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.errors[0].message, 'Missing title')
    assert.equal(file.errors[0].ruleId, 'missing-title')
  })

  test('pull title from h1 when title in front matter is missing', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      # Hello world
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.metaData.title, 'Hello world')
  })

  test('pull string only version of title from h1', async (assert) => {
    await fs.outputFile(join(APP_ROOT, 'foo.md'), dedent`
      # Hello [world](world)
    `)

    const file = new File(join(APP_ROOT, 'foo.md'), 'foo.md', getBaseMarkdownOptions({}))
    await file.read()

    assert.equal(file.metaData.title, 'Hello world')
  })
})
