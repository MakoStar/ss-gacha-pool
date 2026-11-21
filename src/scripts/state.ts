import gachaData from '../../public/data/gacha-data.json'
import type { BannerEntry, GachaData, GoodsEntry, GoodsGroup } from '../lib/types'
import type { Lang } from '../lib/i18n'
import { localized } from '../lib/i18n'

/** 站点快照与索引 */
export const gacha = gachaData as unknown as GachaData
export const bannerMap = new Map(gacha.banners.map((banner) => [banner.id, banner]))
export const goodsIndex = new Map<number, GoodsEntry>()
for (const banner of gacha.banners) {
  for (const goods of banner.goods) {
    if (!goodsIndex.has(goods.id)) goodsIndex.set(goods.id, goods)
  }
}

/** 弹窗与工具栏 DOM */
export const dialog = document.querySelector<HTMLDialogElement>('#rate-dialog')
export const dialogBody = document.querySelector<HTMLElement>('#rate-dialog-body')
export const dialogFooter = document.querySelector<HTMLElement>('#rate-dialog-footer')
export const historyDialog = document.querySelector<HTMLDialogElement>('#history-dialog')
export const historyBody = document.querySelector<HTMLElement>('#history-body')
export const historyTitle = document.querySelector<HTMLElement>('#history-title')
export const searchInput = document.querySelector<HTMLInputElement>('#banner-search')
export const searchClear = document.querySelector<HTMLElement>('[data-search-clear]')
export const searchEmpty = document.querySelector<HTMLElement>('[data-search-empty]')

/** 分组网格索引 */
export const GOODS_GROUPS: GoodsGroup[] = ['ssr', 'sr', 'r']
export const groupI18n: Record<GoodsGroup, string> = {
  ssr: 'dialog.group.ssr',
  sr: 'dialog.group.sr',
  r: 'dialog.group.r'
}
export const groupGrids = new Map<string, HTMLElement>()
for (const grid of document.querySelectorAll<HTMLElement>('[data-grid]')) {
  groupGrids.set(grid.dataset.grid ?? '', grid)
}

/** 运行时状态 语言固定中文 多语言接口保留 */
export type Theme = 'dark' | 'light'
export const THEME_KEY = 'ss-gacha-pool-theme'
let lang: Lang = 'CN'
let theme = detectTheme()
let currentFilter = 'all'
let searchQuery = ''
let activeBannerId = 0
let activeTab: 'goods' | 'probability' = 'goods'

export const getLang = () => lang
export const setLang = (value: Lang) => { lang = value }
export const getTheme = () => theme
export const setTheme = (value: Theme) => { theme = value }
export const getFilter = () => currentFilter
export const setFilter = (value: string) => { currentFilter = value }
export const getSearch = () => searchQuery
export const setSearch = (value: string) => { searchQuery = value }
export const getActiveBanner = () => activeBannerId
export const setActiveBanner = (value: number) => { activeBannerId = value }
export const getActiveTab = () => activeTab
export const setActiveTab = (value: 'goods' | 'probability') => { activeTab = value }

/** 读取缓存主题 默认夜间 */
export function detectTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** 按 id 查找卡池 */
export function findBanner(id: number): BannerEntry | null {
  return bannerMap.get(id) ?? null
}

/** 转义文本后再插入弹窗 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** 读取元素上的本地化名称 */
export function nameOf(element: HTMLElement, fallback = ''): string {
  return localized(JSON.parse(element.dataset.localizedName ?? '{}'), lang) || fallback
}
