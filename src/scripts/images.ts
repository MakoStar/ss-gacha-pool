import { bannerChain, imageChain } from '../lib/assets'
import { localized } from '../lib/i18n'
import { getLang, goodsIndex } from './state'

/** 已成功加载的图片地址 避免重复请求与闪占位 */
const loadedImages = new Set<string>()

/** 设置图片地址 记录重试基准并启动超时守卫 */
export function setImageSrc(image: HTMLImageElement, url: string, chain: string[] = []): void {
  image.dataset.srcBase = url
  image.dataset.retry = '0'
  if (chain.length > 0) image.dataset.imgChain = encodeURIComponent(JSON.stringify(chain))
  else delete image.dataset.imgChain
  image.src = url
  watchImage(image)
}

/** 监听加载完成 超时未完成则直接降级 */
function watchImage(image: HTMLImageElement): void {
  window.clearTimeout(Number(image.dataset.timer ?? '0'))
  const timer = window.setTimeout(() => {
    if (!image.complete && image.naturalWidth > 0) failImage(image, true)
  }, 45000)
  image.dataset.timer = String(timer)
}

/** 图片失败时先重试一次 再沿回退链降级 */
function failImage(image: HTMLImageElement, skipRetry = false): void {
  window.clearTimeout(Number(image.dataset.timer ?? '0'))
  const base = image.dataset.srcBase ?? image.src.split('?')[0]
  const tries = Number(image.dataset.retry ?? '0')
  if (!skipRetry && tries < 1) {
    image.dataset.retry = String(tries + 1)
    image.src = `${base}${base.includes('?') ? '&' : '?'}retry=${tries + 1}`
    watchImage(image)
    return
  }
  const raw = image.dataset.imgChain
  if (raw) {
    try {
      const chain = JSON.parse(decodeURIComponent(raw)) as string[]
      if (chain.length > 0) {
        setImageSrc(image, chain[0], chain.slice(1))
        return
      }
    } catch {
    }
  }
  replaceWithPlaceholder(image)
}

/** 标记图片加载完成 淡入显示 */
function markImageLoaded(image: HTMLImageElement): void {
  image.classList.add('is-loaded')
  const src = image.currentSrc || image.getAttribute('src')
  if (src) loadedImages.add(src.split('?')[0])
}

/** 图片最终兜底为占位图 */
function replaceWithPlaceholder(image: HTMLImageElement): void {
  const label = image.dataset.fallbackName ?? ''
  const tile = document.createElement('span')
  tile.className = `${image.className} is-missing`.trim()
  tile.setAttribute('aria-label', label || 'image unavailable')
  tile.setAttribute('role', 'img')
  image.replaceWith(tile)
  tile.closest('.card-cell')?.classList.add('is-missing-cell')
}

/** 绑定图片兜底链 重试与超时守卫 */
export function bindImageFallbacks(root: ParentNode = document): void {
  for (const image of root.querySelectorAll<HTMLImageElement>('img[data-img-chain], img[data-fallback-name]')) {
    if (image.dataset.fallbackBound === 'true') continue
    image.dataset.fallbackBound = 'true'
    if (!image.dataset.srcBase) image.dataset.srcBase = image.getAttribute('src') ?? ''
    if (image.complete && image.naturalWidth === 0) {
      replaceWithPlaceholder(image)
      continue
    }
    if (image.complete && image.naturalWidth > 0) {
      markImageLoaded(image)
      continue
    }
    if (loadedImages.has((image.dataset.srcBase ?? '').split('?')[0])) image.classList.add('is-loaded')
    image.addEventListener('load', () => {
      window.clearTimeout(Number(image.dataset.timer ?? '0'))
      markImageLoaded(image)
    })
    image.addEventListener('error', () => failImage(image))
    watchImage(image)
  }
}

/** 按区域切换角色秘闻与卡面图片 */
export function applyRegionImages(): void {
  const lang = getLang()
  for (const image of document.querySelectorAll<HTMLImageElement>('img[data-banner-file]')) {
    if (image.classList.contains('is-missing')) continue
    const link = bannerChain(image.dataset.bannerFile, lang)
    if (!link || image.dataset.srcBase === link.src) continue
    setImageSrc(image, link.src, link.chain)
  }
  for (const card of document.querySelectorAll<HTMLElement>('.card[data-goods-id]')) {
    const goods = goodsIndex.get(Number(card.dataset.goodsId))
    const art = card.querySelector<HTMLImageElement>('.card-art')
    if (!goods || !art || art.classList.contains('is-missing')) continue
    const link = imageChain({
      region: lang,
      cnDir: goods.cnDir ?? undefined,
      cnFile: goods.cnIcon,
      apiFile: goods.icon
    })
    if (!link || art.dataset.srcBase === link.src) continue
    art.dataset.fallbackName = localized(goods.i18n?.name, lang) || goods.name
    setImageSrc(art, link.src, link.chain)
  }
}
