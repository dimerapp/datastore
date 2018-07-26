/*
* md-serve
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

const test = require('japa')
const { join } = require('path')
const fs = require('fs-extra')
const Markdown = require('@dimerapp/markdown')
const dedent = require('dedent')
const search = require('../src/Search')
const Index = require('../src/Index')

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const indexFile = join(__dirname, 'index.json')

test.group('Search', (group) => {
  group.afterEach(async () => {
    search.clearCache()
    await fs.remove(indexFile)
  })

  test('load index from disk and search', async (assert) => {
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ### This is section 2.1
    Here's the section 2.1 content

    ## This is section 3
    Some different content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    const index = new Index(indexFile)
    index.addDoc(vfile.contents, '/hello')
    await index.save()

    const output = await search.search(indexFile, 'different')
    assert.equal(output[0].ref, '/hello#this-is-section-3')
    assert.deepEqual(output[0].doc, index.docs['/hello#this-is-section-3'])
  })

  test('do not reload index when cached', async (assert) => {
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ### This is section 2.1
    Here's the section 2.1 content

    ## This is section 3
    Some different content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    const index = new Index(indexFile)
    index.addDoc(vfile.contents, '/hello')
    await index.save()

    await search.search(indexFile, 'different')

    const _loadIndex = search.loadIndex
    search.loadIndex = function () {
      throw new Error('Should not be called')
    }

    const output = await search.search(indexFile, 'different')
    assert.equal(output[0].ref, '/hello#this-is-section-3')
    assert.deepEqual(output[0].doc, index.docs['/hello#this-is-section-3'])

    search.loadIndex = _loadIndex
  })

  test('reload index when index is written back to the disk', async (assert) => {
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ### This is section 2.1
    Here's the section 2.1 content

    ## This is section 3
    Some different content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    const index = new Index(indexFile)
    index.addDoc(vfile.contents, '/hello')
    await index.save()

    await search.search(indexFile, 'different')
    const firstMTime = search.indexesCache.get(indexFile).mtime

    index.docs['/hello#hello-world'].title = 'Updated title'
    await index.save()

    await sleep(4000)
    await search.search(indexFile, 'different')

    assert.isTrue(firstMTime < search.indexesCache.get(indexFile).mtime)
  }).timeout(8000)

  test('invalid cache indexes when index file is missing from the disk', async (assert) => {
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ### This is section 2.1
    Here's the section 2.1 content

    ## This is section 3
    Some different content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    const index = new Index(indexFile)
    index.addDoc(vfile.contents, '/hello')
    await index.save()

    await search.search(indexFile, 'hello')

    assert.isDefined(search.indexesCache.get(indexFile).mtime)
    await fs.remove(indexFile)

    await search.revalidate()
    assert.deepEqual(search.indexesCache, new Map())
  })
})
