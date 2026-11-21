export type LocalizedNames = Record<string, string>

export type BannerCategory = 'limited' | 'special' | 'rerun' | 'permanent' | 'standard'
export type BadgeKind = 'limited' | 'rerun' | 'special' | 'permanent' | 'standard'

/** 物品清单三段分组 */
export type GoodsGroup = 'ssr' | 'sr' | 'r'

export interface GoodsEntry {
  id: number
  name: string
  i18n: { name: LocalizedNames }
  element: string | null
  kind: 'trekker' | 'disc'
  rarity: 1 | 2 | 3 | 4 | 5
  group: GoodsGroup
  featured: boolean
  icon: string | null
  portrait: string | null
  /** 国服镜像纹理文件名与目录 head 或 outfit */
  cnIcon: string | null
  cnDir: 'head' | 'outfit' | null
  /** 由配置表计算的绝对掉率百分比 */
  prob: number
}

export interface BannerNotes {
  upTitle: string
  upFiveRate: string
  upFourRate: string
  listTitle: string
  groups: Record<GoodsGroup, string>
  sections: Array<{ title: string, body: string }>
}

export interface BannerAssets {
  banner: string | null
  tabIcon: string | null
  cover: string | null
  display: string | null
}

export interface BannerEntry {
  id: number
  name: string
  i18n: { name: LocalizedNames, type: LocalizedNames }
  type: string
  category: BannerCategory
  badges: BadgeKind[]
  isRerun: boolean
  gachaType: number
  storageId: number
  poolKind: 'trekker' | 'disc' | 'mixed'
  bucket: 'current' | 'upcoming' | 'permanent' | 'ended'
  permanent: boolean
  startTime: string | null
  endTime: string | null
  sort: number
  assets: BannerAssets
  rateUp: {
    fiveStar: number | null
    fourStar: number | null
  }
  goods: GoodsEntry[]
  /** 按语言代码索引的官方说明 */
  notes: Record<string, BannerNotes> | null
  /** 常驻池历期包构成 仅 GachaType 2 与 4 */
  poolSnapshot?: { gachaType: number, fiveStar: number[], up: number[], fourStar: number[] } | null
}

export interface CharacterRecord {
  id: number
  name: string | null
  element: string | null
  icon: string | null
  portrait: string | null
  grade: number
}

export interface DiscRecord {
  id: number
  name: string | null
  element: string | null
  icon: string | null
  base: string | null
  star: number
}

export interface GachaData {
  language: string
  languages: string[]
  dataSource: string
  generatedAt: string
  source: string
  featuredId: number
  banners: BannerEntry[]
  catalogs: {
    characters: CharacterRecord[]
    discs: DiscRecord[]
  }
}
