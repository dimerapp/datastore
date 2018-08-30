<a name="2.0.1"></a>
## [2.0.1](https://github.com/dimerapp/datastore/compare/v2.0.0...v2.0.1) (2018-08-30)


### Bug Fixes

* **datastore:** getVersions return null when parent zone is missing ([6ebdf94](https://github.com/dimerapp/datastore/commit/6ebdf94))


### Features

* **datastore:** implement getZones fn ([f8ad8b8](https://github.com/dimerapp/datastore/commit/f8ad8b8))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/dimerapp/datastore/compare/v1.0.19...v2.0.0) (2018-08-29)


### Features

* **db:** add support for zones inside db ([62eda3d](https://github.com/dimerapp/datastore/commit/62eda3d))
* **zones:** add support to sync zones ([7f34b7e](https://github.com/dimerapp/datastore/commit/7f34b7e))
* **zones:** make search and datastore to support zones ([68482d6](https://github.com/dimerapp/datastore/commit/68482d6))



<a name="1.0.19"></a>
## [1.0.19](https://github.com/dimerapp/datastore/compare/v1.0.18...v1.0.19) (2018-08-03)


### Bug Fixes

* **datastore:** pass limit to search class ([a01049f](https://github.com/dimerapp/datastore/commit/a01049f))



<a name="1.0.18"></a>
## [1.0.18](https://github.com/dimerapp/datastore/compare/v1.0.17...v1.0.18) (2018-08-03)


### Features

* **search:** accept limit to limit search results ([4331547](https://github.com/dimerapp/datastore/commit/4331547))



<a name="1.0.17"></a>
## [1.0.17](https://github.com/dimerapp/datastore/compare/v1.0.16...v1.0.17) (2018-08-03)



<a name="1.0.16"></a>
## [1.0.16](https://github.com/dimerapp/datastore/compare/v1.0.15...v1.0.16) (2018-08-01)


### Bug Fixes

* **datastore:** use ctx.get to access properties ([37fbcb8](https://github.com/dimerapp/datastore/commit/37fbcb8))



<a name="1.0.15"></a>
## [1.0.15](https://github.com/dimerapp/datastore/compare/v1.0.14...v1.0.15) (2018-08-01)


### Code Refactoring

* **datastore:** use ctx ([c755451](https://github.com/dimerapp/datastore/commit/c755451))


### Features

* **datastore:** omit compilerOptions when calling getConfig ([e9b2fb2](https://github.com/dimerapp/datastore/commit/e9b2fb2))


### BREAKING CHANGES

* **datastore:** first argument to is now an instance of ctx over baseDir



<a name="1.0.14"></a>
## [1.0.14](https://github.com/dimerapp/datastore/compare/v1.0.13...v1.0.14) (2018-07-29)


### Code Refactoring

* **datastore:** drop jsonPath property from docs object ([a135815](https://github.com/dimerapp/datastore/commit/a135815))


### Features

* **loadContent:** now docs can hold it's version node as a property ([717b1fa](https://github.com/dimerapp/datastore/commit/717b1fa))


### BREAKING CHANGES

* **datastore:** doc object will not have jsonPath property, ideally this property is not even
required to render views



<a name="1.0.13"></a>
## [1.0.13](https://github.com/dimerapp/datastore/compare/v1.0.12...v1.0.13) (2018-07-28)



<a name="1.0.13"></a>
## [1.0.13](https://github.com/dimerapp/datastore/compare/v1.0.12...v1.0.13) (2018-07-28)



<a name="1.0.12"></a>
## [1.0.12](https://github.com/dimerapp/datastore/compare/v1.0.11...v1.0.12) (2018-07-26)


### Features

* **search:** return an array of marks for search results ([9e5482d](https://github.com/dimerapp/datastore/commit/9e5482d))



<a name="1.0.11"></a>
## [1.0.11](https://github.com/dimerapp/datastore/compare/v1.0.10...v1.0.11) (2018-07-26)


### Bug Fixes

* **search:** handle case when search index is missing ([b4a107b](https://github.com/dimerapp/datastore/commit/b4a107b))



<a name="1.0.10"></a>
## [1.0.10](https://github.com/dimerapp/datastore/compare/v1.0.9...v1.0.10) (2018-07-26)


### Bug Fixes

* **index:** do not append href to index url when tag is h1 ([0055ca5](https://github.com/dimerapp/datastore/commit/0055ca5))



<a name="1.0.9"></a>
## [1.0.9](https://github.com/dimerapp/datastore/compare/v1.0.8...v1.0.9) (2018-07-26)


### Bug Fixes

* **search:** add a check on size along with mtime ([62f3abc](https://github.com/dimerapp/datastore/commit/62f3abc))
* **search:** use mtimeMs over mtime for accuracy ([8cc0380](https://github.com/dimerapp/datastore/commit/8cc0380))



<a name="1.0.8"></a>
## [1.0.8](https://github.com/dimerapp/datastore/compare/v1.0.7...v1.0.8) (2018-07-25)


### Bug Fixes

* **datastore:** omit versions from getConfig call ([0b14899](https://github.com/dimerapp/datastore/commit/0b14899))
* **datastore:** return docs those who doesn't have redirects array ([bb9d975](https://github.com/dimerapp/datastore/commit/bb9d975))



<a name="1.0.7"></a>
## [1.0.7](https://github.com/dimerapp/datastore/compare/v1.0.6...v1.0.7) (2018-07-25)


### Bug Fixes

* **datastore:** return null from getTree when version doesn't exists ([b00f376](https://github.com/dimerapp/datastore/commit/b00f376))



<a name="1.0.6"></a>
## [1.0.6](https://github.com/dimerapp/datastore/compare/v1.0.5...v1.0.6) (2018-07-25)


### Bug Fixes

* return null when doc is missing ([49f3247](https://github.com/dimerapp/datastore/commit/49f3247))
* use correct property name for fetching title from ast ([2262cc8](https://github.com/dimerapp/datastore/commit/2262cc8))



<a name="1.0.5"></a>
## [1.0.5](https://github.com/dimerapp/datastore/compare/v1.0.4...v1.0.5) (2018-07-25)



<a name="1.0.4"></a>
## [1.0.4](https://github.com/dimerapp/datastore/compare/v1.0.3...v1.0.4) (2018-07-25)


### Features

* **datastore:** add support to load store from clean slate ([a419685](https://github.com/dimerapp/datastore/commit/a419685))



<a name="1.0.3"></a>
## [1.0.3](https://github.com/dimerapp/datastore/compare/v1.0.2...v1.0.3) (2018-07-24)


### Features

* **syncVersions:** return an object of added and removed versions ([ab46a52](https://github.com/dimerapp/datastore/commit/ab46a52))



<a name="1.0.2"></a>
## [1.0.2](https://github.com/dimerapp/datastore/compare/v1.0.1...v1.0.2) (2018-07-23)


### Features

* add support to persist db after collective changes ([2ca45d2](https://github.com/dimerapp/datastore/commit/2ca45d2))



<a name="1.0.1"></a>
## [1.0.1](https://github.com/dimerapp/datastore/compare/v1.0.0...v1.0.1) (2018-07-22)



<a name="1.0.0"></a>
# 1.0.0 (2018-07-22)


### Bug Fixes

* **saveDoc:** check for filePath during permalink uniqueness check ([a5e3e85](https://github.com/dimerapp/datastore/commit/a5e3e85))
* **search:** ensure a new index is created when calling indexVersion ([022a642](https://github.com/dimerapp/datastore/commit/022a642))


### Features

* get a working version of docs out ([5f3bd8c](https://github.com/dimerapp/datastore/commit/5f3bd8c))
* add method to sync site meta data ([c69b871](https://github.com/dimerapp/datastore/commit/c69b871))
* **savedoc:** ensure permalinks are unique ([6a996b6](https://github.com/dimerapp/datastore/commit/6a996b6))
* **search:** add support for search via elasticlunr ([8f8e7cf](https://github.com/dimerapp/datastore/commit/8f8e7cf))
* add redirectedPermalink method to find redirects ([3d0453b](https://github.com/dimerapp/datastore/commit/3d0453b))



