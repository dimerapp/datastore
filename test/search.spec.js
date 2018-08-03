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

const indexFile = join(__dirname, 'app', 'index.json')

test.group('Search', (group) => {
  group.afterEach(async () => {
    search.clearCache()
    await fs.remove(join(__dirname, 'app'))
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

    assert.deepEqual(output[0].marks.title, [
      {
        type: 'raw',
        text: 'This is section 3'
      }
    ])

    assert.deepEqual(output[0].marks.body, [
      {
        type: 'raw',
        text: 'Some '
      },
      {
        type: 'mark',
        text: 'different'
      },
      {
        type: 'raw',
        text: ' content'
      }
    ])
  })

  test('create proper marks for matched content', async (assert) => {
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ### This is section 2.1
    Here's the section 2.1 content

    ## Yaml front matter
    Yaml front matter is used for matching content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    const index = new Index(indexFile)
    index.addDoc(vfile.contents, '/hello')
    await index.save()

    const output = await search.search(indexFile, 'front matter')
    assert.equal(output[0].ref, '/hello#yaml-front-matter')

    assert.deepEqual(output[0].marks.title, [
      {
        type: 'raw',
        text: 'Yaml '
      },
      {
        type: 'mark',
        text: 'front'
      },
      {
        type: 'raw',
        text: ' '
      },
      {
        type: 'mark',
        text: 'matter'
      }
    ])

    assert.deepEqual(output[0].marks.body, [
      {
        type: 'raw',
        text: 'Yaml '
      },
      {
        type: 'mark',
        text: 'front'
      },
      {
        type: 'raw',
        text: ' '
      },
      {
        type: 'mark',
        text: 'matter'
      },
      {
        type: 'raw',
        text: ' is used for matching content'
      }
    ])
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
    const firstSize = search.indexesCache.get(indexFile).size

    index.docs['/hello'].title = 'Updated title'
    await index.save()

    await sleep(4000)
    await search.search(indexFile, 'different')

    assert.isTrue((firstMTime < search.indexesCache.get(indexFile).mtime || firstSize !== search.indexesCache.get(indexFile).size))
  }).timeout(8000)

  test('invalidate cache indexes when index file is missing from the disk', async (assert) => {
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

  test('return empty array when there is no index to search', async (assert) => {
    const output = await search.search(indexFile, 'different')
    assert.deepEqual(output, [])
  })

  test('limit search results', async (assert) => {
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

    const output = await search.search(indexFile, 'section', 1)
    assert.lengthOf(output, 1)
  })
})
