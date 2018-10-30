/*
 * datastore
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

export type IDocNode = {
  permalink: string,
  title: string,
  toc: boolean,
  content: any,
  srcPath?: string,
  category?: string,
  sidebarLabel?: string,
  redirects?: string[],
  editUrl?: string,
  meta?: any,
}

export type IConfigVersion = {
  no: string,
  location: string,
  draft: boolean,
  depreciated: boolean,
  default: boolean,
  name?: string,
}

export type IConfigZone = {
  slug: string,
  name?: string,
  versions: IConfigVersion[],
}

export type IProjectConfig = {
  domain?: string,
  cname?: string,
  theme?: string,
  zones: IConfigZone[],
  compilerOptions: any,
  themeOptions: any,
}
