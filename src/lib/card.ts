/** 卡面分层结构 旅人叠边框 秘闻叠底板 */
import { imageChain, uiAssetUrl } from './assets'
import { elementInfo } from './elements'
import { localized, type Lang } from './i18n'
import type { GoodsEntry } from './types'

/** 旅人边框按品级取文件 */
function charFrameFile(rarity: number): string {
  const tier = rarity >= 5 ? 5 : rarity === 4 ? 4 : rarity === 3 ? 3 : 0
  return `frame-char-${tier}.png`
}

/** 秘闻底板按稀有度取文件 */
function discPlateFile(rarity: number): string {
  return `plate-${Math.min(5, Math.max(1, rarity))}.png`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface CardOptions {
  lang: Lang
  eager?: boolean
  extraClass?: string
  showName?: boolean
}

/** 生成卡片结构 归档 当期与弹窗共用 */
export function goodsCardHtml(goods: GoodsEntry, options: CardOptions): string {
  const { lang, eager = false, extraClass = '' } = options
  const element = elementInfo(goods.element)
  const name = localized(goods.i18n?.name, lang) || goods.name
  const disc = goods.kind === 'disc'
  const plate = disc ? uiAssetUrl(discPlateFile(goods.rarity)) : uiAssetUrl('card-bg.png')
  const frame = disc ? '' : uiAssetUrl(charFrameFile(goods.rarity))
  const link = imageChain({
    region: lang,
    cnDir: goods.cnDir ?? undefined,
    cnFile: goods.cnIcon,
    apiFile: goods.icon
  })
  const loading = eager ? 'eager' : 'lazy'
  const artHtml = link
    ? `<img class="card-art" src="${escapeHtml(link.src)}"${
        link.chain.length ? ` data-img-chain="${encodeURIComponent(JSON.stringify(link.chain))}"` : ''
      } alt="${escapeHtml(name)}" data-fallback-name="${escapeHtml(name)}" loading="${loading}" fetchpriority="${eager ? 'auto' : 'low'}" decoding="async" />`
    : `<span class="card-art is-missing" role="img" aria-label="${escapeHtml(name)}"></span>`

  return `
    <span class="card ${disc ? 'card-disc' : 'card-char'} rarity-${goods.rarity}${extraClass ? ` ${extraClass}` : ''}" data-goods-id="${goods.id}" data-goods-kind="${goods.kind}">
      <img class="card-plate" src="${plate}" alt="" aria-hidden="true" loading="${loading}" decoding="async" />
      ${artHtml}
      ${frame ? `<img class="card-frame" src="${frame}" alt="" aria-hidden="true" loading="${loading}" decoding="async" />` : ''}
      <img class="element-icon" src="${uiAssetUrl(element.icon)}" alt="${escapeHtml(element.label)}" title="${escapeHtml(element.label)}" />
    </span>
  `.trim()
}

/** UP 区星级条 */
export function rankStarsHtml(rarity: number): string {
  const file = rarity >= 5 ? 'star-5.png' : 'star-4.png'
  return `<img class="up-stars" src="${uiAssetUrl(file)}" alt="${rarity}" />`
}
