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
const Index = require('../src/Index')

const indexFile = join(__dirname, 'index.json')

test.group('Index', (group) => {
  group.afterEach(async () => {
    await fs.remove(indexFile)
  })

  test('save each section of markdown as a document', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')

    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('do not index pre blocks', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    \`\`\`js
    var a = require('a')
    \`\`\`

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of inline decorated content', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the \`section\` 2 **content**

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of list items', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    - Here's the section 2 content
    - Item 2

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content Item 2`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of ordered list items', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    1. Here's the section 2 content
    2. Item 2

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content Item 2`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of todo items', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    -  [ ] Here's the section 2 content
    -  [x] Item 2

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content Item 2`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of todo items', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    -  [ ] Here's the section 2 content
    -  [x] Item 2

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content Item 2`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('ignore codeblocks inside macros', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    [note]
    \`\`\`js
    var a = require('a')
    \`\`\`
    [/note]

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('make sections of nested headings', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ### This is section 2.1
    Here's the section 2.1 content

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-21': {
        title: 'This is section 2.1',
        body: `Here's the section 2.1 content`,
        url: '/hello#this-is-section-21'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of ordered list items', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    1. Here's the section 2 content
    2. Item 2

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content Item 2`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of todo items', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    -  [ ] Here's the section 2 content
    -  [x] Item 2

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content Item 2`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('index inner content of todo items', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    -  [ ] Here's the section 2 content
    -  [x] Item 2

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content Item 2`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('ignore codeblocks inside macros', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    [note]
    \`\`\`js
    var a = require('a')
    \`\`\`
    [/note]

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    assert.deepEqual(index.docs, {
      '/hello#hello-world': {
        title: 'Hello world',
        body: `This is the first paragraph`,
        url: '/hello#hello-world'
      },
      '/hello#this-is-section-2': {
        title: 'This is section 2',
        body: `Here's the section 2 content`,
        url: '/hello#this-is-section-2'
      },
      '/hello#this-is-section-3': {
        title: 'This is section 3',
        body: `Here's the section 3 content`,
        url: '/hello#this-is-section-3'
      }
    })
  })

  test('write index to disk', async (assert) => {
    const index = new Index(indexFile)
    const content = dedent`
    # Hello world

    This is the first paragraph

    ## This is section 2
    Here's the section 2 content

    ### This is section 2.1
    Here's the section 2.1 content

    ## This is section 3
    Here's the section 3 content
    `

    const markdown = new Markdown(content)
    const vfile = await markdown.toJSON()

    index.addDoc(vfile.contents, '/hello')
    await index.save()

    const hasIndexFile = await fs.exists(indexFile)
    assert.isTrue(hasIndexFile)
  })
})
