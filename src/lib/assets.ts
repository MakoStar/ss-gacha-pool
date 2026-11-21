/** 图片地址解析 国服走 ss-assets 镜像 其他区域走公共 API */
const apiAssetBase = 'https://api.ennead.cc/stella/assets'

/** 国服镜像地址 导出纹理位于 export assetbundles icon 目录 */
const cnAssetBase = import.meta.env.PUBLIC_CN_ASSET_BASE ?? 'https://cdn.jsdelivr.net/gh/MakoStar/ss-assets@main'
const cnIconBase = `${cnAssetBase}/export/assets/assetbundles/icon`

export type Region = 'CN' | 'EN' | 'JP' | 'KR' | 'TW'
export type CnDir = 'head' | 'outfit'

/** 提取路径中的文件名 */
export function toFileName(value?: string | null): string | null {
  if (!value) return null
  const parts = String(value).split('/')
  return parts[parts.length - 1] ?? null
}

/** 站内 UI 素材地址 带上部署 base */
export function uiAssetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}assets/ui/${file}`
}

/** 公共 API 图片地址 */
export function apiAssetUrl(value?: string | null): string | null {
  const file = toFileName(value)
  if (!file) return null
  return `${apiAssetBase}/${encodeURIComponent(file)}`
}

/** 国服导出纹理地址 */
export function cnIconUrl(dir: CnDir, file?: string | null): string | null {
  if (!file) return null
  return `${cnIconBase}/${dir}/${encodeURIComponent(file)}`
}

export interface ImageLink {
  src: string
  chain: string[]
}

/** 构建按顺序回退的图片链 */
export function imageChain(options: {
  region: Region
  cnDir?: CnDir
  cnFile?: string | null
  apiFile?: string | null
}): ImageLink | null {
  const { region, cnDir, cnFile, apiFile } = options
  const urls: string[] = []
  if (region === 'CN' && cnDir && cnFile) {
    const cn = cnIconUrl(cnDir, cnFile)
    if (cn) urls.push(cn)
  }
  const remote = apiAssetUrl(apiFile)
  if (remote) urls.push(remote)
  if (urls.length === 0) return null
  return { src: urls[0], chain: urls.slice(1) }
}

/** banner 图片链 国服镜像按前缀区分目录 */
function cnArtUrl(name: string): string {
  const dir = name.startsWith('tab_') ? 'gacha' : 'banner'
  return `${cnAssetBase}/export/assets/assetbundles/icon/${dir}/${encodeURIComponent(name)}.webp`
}

export function bannerChain(apiFile: string | null | undefined, region: Region): ImageLink | null {
  const file = toFileName(apiFile)
  if (!file) return null
  const stem = file.replace(/\.png$/i, '')
  const urls: string[] = []
  if (region === 'CN') {
    urls.push(cnArtUrl(stem))
    if (stem.endsWith('_lang')) urls.push(cnArtUrl(stem.replace(/_lang$/, '')))
  }
  const api = apiAssetUrl(apiFile)
  if (api) urls.push(api)
  return urls.length > 0 ? { src: urls[0], chain: urls.slice(1) } : null
}

