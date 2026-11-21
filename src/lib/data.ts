import raw from '../../public/data/gacha-data.json'
import type { BannerEntry, GachaData, GoodsEntry } from './types'
import { getBannerStatus, type BannerStatus } from './date'

export const gacha = raw as unknown as GachaData
/** 固定语言 预留多语言接口 */
export const lang = 'CN' as const

export const bannerMap = new Map(gacha.banners.map((banner) => [banner.id, banner]))

export const groupOrder: BannerStatus[] = ['upcoming', 'ongoing', 'permanent', 'ended']

export const filterItems = [
  { key: 'all', i18n: 'filter.all' },
  { key: 'ongoing', i18n: 'filter.ongoing' },
  { key: 'upcoming', i18n: 'filter.upcoming' },
  { key: 'ended', i18n: 'filter.ended' },
  { key: 'permanent', i18n: 'filter.permanent' },
  { key: 'standard', i18n: 'filter.standard' },
  { key: 'trekker', i18n: 'filter.trekker' },
  { key: 'disc', i18n: 'filter.disc' },
  { key: 'limited', i18n: 'filter.limited' },
  { key: 'rerun', i18n: 'filter.rerun' },
  { key: 'special', i18n: 'filter.special' }
]

/** 当期卡池 UP 优先复刻随后 */
export function currentPools(): BannerEntry[] {
  const now = new Date()
  return gacha.banners
    .filter((banner) => getBannerStatus(banner, now) === 'ongoing')
    .sort((a, b) => {
      if (a.isRerun !== b.isRerun) return a.isRerun ? 1 : -1
      const kindA = a.poolKind === 'trekker' ? 0 : a.poolKind === 'disc' ? 1 : 0.5
      const kindB = b.poolKind === 'trekker' ? 0 : b.poolKind === 'disc' ? 1 : 0.5
      if (kindA !== kindB) return kindA - kindB
      return b.sort - a.sort || b.id - a.id
    })
}

/** 首屏主推卡池 */
export function featuredBanner(): BannerEntry {
  const pools = currentPools()
  return pools.find((banner) => !banner.isRerun && banner.poolKind === 'trekker')
    ?? pools.find((banner) => !banner.isRerun)
    ?? pools[0]
    ?? gacha.banners[0]
}

/** 归档分组 */
export function archiveGroups() {
  const now = new Date()
  return groupOrder.map((key) => ({
    key,
    banners: gacha.banners.filter((banner) => getBannerStatus(banner, now) === key)
  }))
}

/** 卡池 UP 货物 无 UP 时回退前三个 */
export function upGoods(banner: BannerEntry, limit = 3) {
  const featured = banner.goods.filter((goods) => goods.featured)
  return (featured.length > 0 ? featured : banner.goods).slice(0, limit)
}

/** 卡池持续天数 */
export function bannerDays(banner: BannerEntry): number {
  if (!banner.startTime || !banner.endTime) return 0
  return Math.max(1, Math.round((Date.parse(banner.endTime) - Date.parse(banner.startTime)) / 86400000))
}

export interface PeriodPool {
  banner: BannerEntry
  up: ReturnType<typeof upGoods>
}

export interface TimelinePeriod {
  key: string
  start: string
  end: string
  days: number
  status: BannerStatus
  pools: PeriodPool[]
}

/** 同期分组 旅人池与对应的秘纹池归为一期 */
export function buildPeriods(): { periods: TimelinePeriod[], total: number, ongoing: number, avgDays: number } {
  const now = new Date()
  const timed = gacha.banners.filter((banner) => banner.startTime && banner.endTime)
  const kindRank: Record<string, number> = { trekker: 0, disc: 1, mixed: 2 }
  const buckets = new Map<string, BannerEntry[]>()
  for (const banner of timed) {
    const key = `${banner.startTime}|${banner.endTime}`
    const list = buckets.get(key) ?? []
    list.push(banner)
    buckets.set(key, list)
  }
  const periods: TimelinePeriod[] = [...buckets.entries()].map(([key, list]) => {
    const poolOrder = (a: BannerEntry, b: BannerEntry) =>
      (kindRank[a.poolKind] ?? 3) - (kindRank[b.poolKind] ?? 3) || b.id - a.id
    list.sort(poolOrder)
    const days = bannerDays(list[0])
    return {
      key,
      start: list[0].startTime as string,
      end: list[0].endTime as string,
      days,
      status: getBannerStatus(list[0], now),
      pools: list.map((banner) => ({ banner, up: upGoods(banner, 3) }))
    }
  })
  periods.sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  const ongoing = periods.filter((period) => period.status === 'ongoing').length
  const avgDays = Math.round(periods.reduce((sum, period) => sum + period.days, 0) / Math.max(1, periods.length))
  return { periods, total: periods.length, ongoing, avgDays }
}

/** 期窗口到卡池的索引 用于找同期配对池 */
function windowIndex(): Map<string, BannerEntry[]> {
  const map = new Map<string, BannerEntry[]>()
  for (const banner of gacha.banners) {
    if (!banner.startTime || !banner.endTime) continue
    const key = `${banner.startTime}|${banner.endTime}`
    const list = map.get(key) ?? []
    list.push(banner)
    map.set(key, list)
  }
  return map
}

/** 卡池结束时间 缺失时回退开始时间 */
function endOf(banner: BannerEntry): string {
  return banner.endTime ?? banner.startTime ?? ''
}

/** 距结束日期的天数 未来结束的卡池按 0 计 */
function daysSinceEnd(now: number, end: string): number {
  return Math.max(0, Math.floor((now - Date.parse(end)) / 86400000))
}

export interface SuitePair {
  trekker: GoodsEntry
  disc: GoodsEntry
  appearances: { date: string, banner: BannerEntry, partner: BannerEntry }[]
  ongoing: boolean
  sinceDate: string
  sinceLast: number
}

/** 复刻套 5 星旅人与同期 5 星秘纹绑定为一套 角色配专武 */
export function buildSuites(): { suites: SuitePair[], total: number, recurring: number, avgGap: number, minSince: number } {
  const windows = windowIndex()
  const byTrekker = new Map<number, { goods: GoodsEntry, banners: BannerEntry[] }>()
  for (const banner of gacha.banners) {
    if (banner.category === 'permanent' || !banner.startTime) continue
    for (const goods of banner.goods.filter((entry) => entry.featured && entry.rarity === 5 && entry.kind === 'trekker')) {
      const entry = byTrekker.get(goods.id) ?? { goods, banners: [] }
      if (!entry.banners.some((item) => item.id === banner.id)) entry.banners.push(banner)
      byTrekker.set(goods.id, entry)
    }
  }
  const now = Date.now()
  const suites: SuitePair[] = [...byTrekker.values()].map(({ goods, banners }) => {
    const sorted = [...banners].sort((a, b) => Date.parse(a.startTime as string) - Date.parse(b.startTime as string))
    const appearances = sorted.map((banner) => {
      const sameWindow = windows.get(`${banner.startTime}|${banner.endTime}`) ?? []
      const partner = sameWindow.find((item) => item.id !== banner.id && item.poolKind === 'disc')
        ?? sameWindow.find((item) => item.id !== banner.id)
        ?? banner
      return { date: banner.startTime as string, banner, partner }
    })
    return {
      trekker: goods,
      disc: { ...goods, id: -goods.id, name: '', kind: 'disc' } as GoodsEntry,
      appearances,
      ongoing: false,
      sinceDate: '',
      sinceLast: 0
    }
  })
  for (const suite of suites) {
    const first = suite.appearances[0]
    const discWin = windows.get(`${first.banner.startTime}|${first.banner.endTime}`) ?? []
    const discBanner = discWin.find((item) => item.poolKind === 'disc') ?? first.partner
    const discFive = discBanner?.goods.find((entry) => entry.featured && entry.rarity === 5 && entry.kind === 'disc')
    if (discFive) suite.disc = discFive
    const last = suite.appearances[suite.appearances.length - 1]
    suite.ongoing = getBannerStatus(last.banner, new Date()) === 'ongoing'
    suite.sinceDate = endOf(last.banner)
    suite.sinceLast = daysSinceEnd(now, suite.sinceDate)
  }
  suites.sort((a, b) => {
    if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1
    if (a.ongoing && b.ongoing) return a.sinceLast - b.sinceLast
    return b.sinceLast - a.sinceLast
  })
  const recurring = suites.filter((suite) => suite.appearances.length > 1)
  const gaps = recurring.flatMap((suite) => suite.appearances.slice(1).map((node, index) => (Date.parse(node.date) - Date.parse(suite.appearances[index].date)) / 86400000))
  const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((sum, value) => sum + value, 0) / gaps.length) : 0
  const minSince = suites.length > 0 ? Math.min(...suites.map((suite) => suite.sinceLast)) : 0
  return { suites, total: suites.length, recurring: recurring.length, avgGap, minSince }
}

export interface StarRecord {
  goods: GoodsEntry
  banners: BannerEntry[]
  count: number
  first: string
  last: string
  sinceDate: string
  sinceLast: number
}

/** 4 星陪跑的登场史 旅人与秘纹分列 */
export function buildFourStars(): { trekkers: StarRecord[], discs: StarRecord[] } {
  const collect = (kind: 'trekker' | 'disc') => {
    const byGoods = new Map<number, { goods: GoodsEntry, banners: BannerEntry[] }>()
    for (const banner of gacha.banners) {
      if (banner.category === 'permanent' || !banner.startTime) continue
      for (const goods of banner.goods.filter((entry) => entry.featured && entry.rarity === 4 && entry.kind === kind)) {
        const entry = byGoods.get(goods.id) ?? { goods, banners: [] }
        if (!entry.banners.some((item) => item.id === banner.id)) entry.banners.push(banner)
        byGoods.set(goods.id, entry)
      }
    }
    const now = Date.now()
    return [...byGoods.values()].map(({ goods, banners }) => {
      const sorted = [...banners].sort((a, b) => Date.parse(a.startTime as string) - Date.parse(b.startTime as string))
      const lastBanner = sorted[sorted.length - 1]
      const sinceDate = endOf(lastBanner)
      return {
        goods,
        banners: sorted,
        count: sorted.length,
        first: sorted[0].startTime as string,
        last: lastBanner.startTime as string,
        sinceDate,
        sinceLast: daysSinceEnd(now, sinceDate)
      }
    }).sort((a, b) => b.sinceLast - a.sinceLast)
  }
  return { trekkers: collect('trekker'), discs: collect('disc') }
}

export interface StandardArrivalGroup {
  date: string
  source: string
  reason: string
  kind: 'trekker' | 'disc'
  bannerId: number | null
  bannerFile: string | null
  goods: GoodsEntry[]
}

export interface StandardRarityGroup {
  key: string
  label: string
  goods: GoodsEntry[]
}

export interface StandardPoolInfo {
  id: number
  name: string
  bannerFile: string | null
}

/** 常驻池新增角色与全部货物 以启程卡池货物为默认基准 */
export function buildStandard(): {
  groups: StandardArrivalGroup[]
  additions: GoodsEntry[]
  catalog: { trekker: StandardRarityGroup[], disc: StandardRarityGroup[] }
  pools: { trekker: StandardPoolInfo, disc: StandardPoolInfo }
} {
  const goodsIndex = new Map<number, GoodsEntry>()
  for (const banner of gacha.banners) {
    for (const goods of banner.goods) {
      if (!goodsIndex.has(goods.id)) goodsIndex.set(goods.id, goods)
    }
  }

  const starter = gacha.banners.find((banner) => banner.gachaType === 5)
  const baseline = new Set(starter?.goods
    .filter((goods) => goods.rarity === 5 && goods.kind === 'trekker')
    .map((goods) => goods.id) ?? [])
  const permanent = gacha.banners.find((banner) => banner.gachaType === 2)
  const additions = (permanent?.poolSnapshot?.fiveStar ?? [])
    .filter((id) => !baseline.has(id))
    .map((id) => goodsIndex.get(id))
    .filter((goods): goods is GoodsEntry => Boolean(goods))

  const joinBanner = gacha.banners.find((banner) => banner.name === '星途一载·予缘重聚')
  const source = joinBanner?.name ?? '星途一载·予缘重聚'
  const date = joinBanner?.endTime?.slice(0, 10) ?? '2026-11-10'
  const reason = `${source}结束后加入常驻`

  /** 旅人入常驻时 同期限定池的五星秘纹作为伴生入池货物 */
  const pairedDiscs = (items: GoodsEntry[]): GoodsEntry[] => {
    const result: GoodsEntry[] = []
    for (const goods of items) {
      const limited = gacha.banners.find((banner) =>
        !banner.permanent && banner.startTime &&
        banner.goods.some((item) => item.featured && item.rarity === 5 && item.id === goods.id))
      if (!limited) continue
      const paired = gacha.banners.find((banner) =>
        !banner.permanent && banner.id !== limited.id &&
        banner.startTime === limited.startTime && banner.endTime === limited.endTime)
      const disc = paired?.goods.find((item) => item.featured && item.rarity === 5 && item.kind === 'disc')
      if (disc && !result.some((item) => item.id === disc.id)) result.push(disc)
    }
    return result
  }

  const discAdditions = pairedDiscs(additions)
  const groups: StandardArrivalGroup[] = []
  if (additions.length > 0) {
    groups.push({
      date, source, reason, kind: 'trekker',
      bannerId: joinBanner?.id ?? null,
      bannerFile: joinBanner?.assets.display ?? null,
      goods: additions
    })
  }
  if (discAdditions.length > 0) {
    groups.push({
      date, source, reason, kind: 'disc',
      bannerId: joinBanner?.id ?? null,
      bannerFile: joinBanner?.assets.display ?? null,
      goods: discAdditions
    })
  }

  const catalogOf = (gachaType: number): StandardRarityGroup[] => {
    const banner = gacha.banners.find((item) => item.gachaType === gachaType)
    const seen = new Set<number>()
    const goods = (banner?.goods ?? []).filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    const groups: StandardRarityGroup[] = []
    for (const rarity of [5, 4, 3]) {
      for (const kind of ['trekker', 'disc'] as const) {
        const list = goods.filter((item) => item.rarity === rarity && item.kind === kind)
        if (list.length === 0) continue
        groups.push({
          key: `${rarity}-${kind}`,
          label: `可能出现的${rarity}星${kind === 'trekker' ? '旅人' : '秘纹'}`,
          goods: list
        })
      }
    }
    return groups
  }

  const poolInfoOf = (gachaType: number): StandardPoolInfo => {
    const banner = gacha.banners.find((item) => item.gachaType === gachaType)
    return {
      id: banner?.id ?? 0,
      name: banner?.name ?? '',
      bannerFile: banner?.assets.display ?? null
    }
  }

  return {
    groups,
    additions,
    catalog: { trekker: catalogOf(2), disc: catalogOf(4) },
    pools: { trekker: poolInfoOf(2), disc: poolInfoOf(4) }
  }
}

/** 货物在 stelladb 的详情地址 */
export function stelladbUrl(goods: { id: number, kind: string }): string {
  const section = goods.kind === 'disc' ? 'disc' : 'trekker'
  return `https://stelladb.pages.dev/${section}/${goods.id}`
}
