# md-serve

[![travis-image]][travis-url]
[![npm-image]][npm-url]

## Identities
The following identities exists in a hierachy

### Site
- domain (string)              [required]
- cname (string)               [optional]
- settings (arbitary object)   [optional = {}]
- public (boolean)             [optional = true]

### Versions
- no (string)            [required]
- name (string)          [optional = this.no]
- heroDoc (string)       [optional = firstDoc]
- default (boolean)      [optional]
- depreciated (boolean)  [optional = false]
- draft (boolean)        [optional = false]

### Docs
- content  (string)     [required]
- metaData (object)     [required]
  - permalink (string)  [required]
  - title (string)      [required]
  - filePath (string)   [required]
  - category (string)   [optional = root]
  - summary (string)    [optional = '']
  - redirects (array)   [optional = []]

## API
The following is the REST API to access the details for a given site

**/settings.json**
```json
{
  "domain": "",
  "cname": "",
  "settings": {}
}
```

**/versions.json**
```json
[
  {
    "name": "",
    "no": "",
    "heroDoc": "<string>",
    "default": false,
    "depreciated": false,
    "draft": false
  }
]
```

**/version/:id/docs.json** (nodes=false)
```json
[
  {
    "category": "Getting started",
    "docs": [
      {
        "permalink": "",
        "title": "",
        "summary": "",
        "redirects": [],
        "nodes": [
          {
          }
        ]
      }
    ]
  }
]
```

**/version/:id/docs.json** (nodes=false)
```json
[
  {
    "category": "Getting started",
    "docs": [
      {
        "permalink": "",
        "title": "",
        "summary": "",
        "nodes": [
          {
          }
        ]
      }
    ]
  }
]
```

**/version/default/docs.json** (nodes=false)
Returns for the `default` version.

```json
[
  {
    "category": "Getting started",
    "docs": [
      {
        "permalink": "",
        "title": "",
        "summary": "",
        "nodes": [
          {
          }
        ]
      }
    ]
  }
]
```

## Change log

The change log can be found in the [CHANGELOG.md](https://github.com/thetutlage/md-serve/CHANGELOG.md) file.

## Contributing

Everyone is welcome to contribute. Please take a moment to review the [contributing guidelines](CONTRIBUTING.md).

## Authors & License
[thetutlage](https://github.com/thetutlage) and [contributors](https://github.com/thetutlage/md-serve/graphs/contributors).

Unlicense License, see the included [Unlicense](LICENSE.md) file.

[travis-image]: https://img.shields.io/travis/thetutlage/md-serve/master.svg?style=flat-square&logo=travis
[travis-url]: https://travis-ci.org/thetutlage/md-serve "travis"

[npm-image]: https://img.shields.io/npm/v/md-serve.svg?style=flat-square&logo=npm
[npm-url]: https://npmjs.org/package/md-serve "npm"
