import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 项目根目录 脚本与数据源都挂在下面 */
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(site, 'public/data/gacha-data.json')
const apiBase = process.env.STELLA_API_BASE ?? 'https://api.ennead.cc/stella'
const buckets = ['upcoming', 'current', 'permanent', 'ended']

/** 支持的语言列表 */
const LANGUAGES = ['CN', 'EN', 'JP', 'KR', 'TW']
const localeMap = { EN: 'en_US', CN: 'zh_CN', JP: 'ja_JP', KR: 'ko_KR', TW: 'zh_TW' }
/** 数据源目录 由 CI 克隆或本地手动克隆到 .data */
const localDirs = [process.env.SS_DATA_DIR, path.join(site, '.data/ss-data')]
  .filter(Boolean)
  .map((value) => path.resolve(site, value))
const localDataDir = localDirs.find((dir) => existsSync(path.join(dir, 'CN/bin/Gacha.json')))

/** 请求接口 JSON */
async function fetchJson(endpoint) {
  const response = await fetch(`${apiBase}${endpoint}`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Request failed ${response.status}`)
  return response.json()
}

/** 读取本地 JSON 失败时返回兜底值 */
async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

/** 读取已提交的数据快照 */
async function readSnapshot() {
  return readJson(outputPath)
}

/** 提取资源路径中的文件名 */
function assetFile(value) {
  if (!value) return null
  const name = String(value).split('/').pop()
  if (!name) return null
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

/** 生成 PNG 文件名 */
function assetName(value, suffix = '') {
  const file = assetFile(value)
  if (!file) return null
  if (file.toLowerCase().endsWith('.png')) return file
  return `${file}${suffix}.png`
}

/** 按回退顺序查本地化文本 */
function lookupText(table, key, fallbackTable) {
  if (!key) return null
  return table?.[key] ?? fallbackTable?.[key] ?? null
}

/** 生成各语言的名称表 */
function buildNames(loaders, key, dataKey = 'gacha') {
  const names = {}
  for (const lang of LANGUAGES) {
    names[lang] = lookupText(loaders[lang]?.[dataKey], key, loaders.CN?.[dataKey]) ?? key ?? null
  }
  return names
}

/** 精简接口图鉴字段 */
function compactCharacter(record) {
  return {
    id: Number(record.id),
    name: record.name ?? null,
    element: record.element ?? null,
    icon: assetFile(record.icon),
    portrait: assetFile(record.portrait),
    grade: Number(record.grade ?? 0)
  }
}

function compactDisc(record) {
  return {
    id: Number(record.id),
    name: record.name ?? null,
    element: record.element ?? null,
    icon: assetFile(record.icon),
    base: assetFile(record.base),
    star: Number(record.star ?? 0)
  }
}

/** 按配置类型与 id 判定卡池分类 */
function poolKindOf(gachaType, storageId) {
  if (storageId === 1 || gachaType === 1 || gachaType === 8) return 'trekker'
  if (storageId === 3 || gachaType === 3 || gachaType === 9) return 'disc'
  return 'mixed'
}

function classifyGacha(gacha) {
  const gachaType = Number(gacha.GachaType)
  const id = Number(gacha.Id)
  const storageId = Number(gacha.StorageId ?? 0)
  const isRerun = id >= 10000 && Math.floor(id / 1000) % 10 === 1

  let category = 'standard'
  if (gachaType === 8 || gachaType === 9) category = 'limited'
  else if (gachaType === 5 || gachaType === 10) category = 'special'
  else if (gachaType === 2 || gachaType === 4 || gachaType === 6 || gachaType === 7) category = 'permanent'

  const badges = []
  if (category === 'limited') badges.push('limited')
  else if (category === 'special') badges.push('special')
  else if (category === 'permanent') badges.push('permanent')
  if (isRerun) badges.push('rerun')
  if (badges.length === 0) badges.push('standard')

  return {
    category,
    badges,
    isRerun,
    gachaType,
    storageId,
    poolKind: poolKindOf(gachaType, storageId)
  }
}

/** 读取本地配置表与各语言文本 */
async function loadLocalData(dir) {
  const binDir = path.join(dir, 'CN/bin')
  const loadBin = (name) => readJson(path.join(binDir, name), {})
  const loaders = {}
  for (const lang of LANGUAGES) {
    const locale = localeMap[lang]
    const base = path.join(dir, lang, `language/${locale}`)
    const loadLan = (name) => readJson(path.join(base, name), {})
    const [gacha, gachaType, item, character, uiText] = await Promise.all([
      loadLan('Gacha.json'),
      loadLan('GachaType.json'),
      loadLan('Item.json'),
      loadLan('Character.json'),
      loadLan('UIText.json')
    ])
    loaders[lang] = { gacha, gachaType, item, character, uiText }
  }
  const [gachaBin, gachaType, gachaPkg, itemBin, characterBin, discBin, storageBin, aTypeBin] = await Promise.all([
    loadBin('Gacha.json'),
    loadBin('GachaType.json'),
    loadBin('GachaPkg.json'),
    loadBin('Item.json'),
    loadBin('Character.json'),
    loadBin('Disc.json'),
    loadBin('GachaStorage.json'),
    loadBin('GachaATypeProb.json')
  ])
  return {
    gacha: gachaBin,
    gachaType,
    gachaPkg,
    item: itemBin,
    character: characterBin,
    disc: discBin,
    storage: storageBin,
    aTypeProb: aTypeBin,
    loaders,
    packages: buildPackages(gachaPkg)
  }
}

/** 建立卡包到物品索引 保留原始顺序 */
function buildPackages(gachaPkg) {
  const packages = new Map()
  for (const row of Object.values(gachaPkg)) {
    const packageId = Number(row.PkgId)
    const goodsId = Number(row.GoodsId)
    if (!packages.has(packageId)) packages.set(packageId, [])
    packages.get(packageId).push({ id: goodsId, weight: Number(row.Weight ?? 1) })
  }
  return packages
}

/** 稀有度枚举转为星级 */
const RARITY_STARS = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }

/** 属性枚举转为属性名 */
const ELEMENT_NAMES = { 1: 'Aqua', 2: 'Ignis', 3: 'Terra', 4: 'Ventus', 5: 'Lux', 6: 'Umbra', 7: 'None' }

/** 物品类型 3 旅人 7 秘纹 */
function isDiscItem(item) {
  return Number(item?.Type) === 7
}

/** 按游戏规则排序 品级降序 旅人优先 再按 id */
function compareGameGoods(a, b) {
  if (a.rarity !== b.rarity) return b.rarity - a.rarity
  if (a.kind !== b.kind) return a.kind === 'trekker' ? -1 : 1
  return a.id - b.id
}

/** 把卡包物品转为展示数据 */
function makeGoodsEntry(id, local, catalogs) {
  const item = local.item[String(id)] ?? {}
  const disc = isDiscItem(item)
  const character = local.character[String(id)]
  const discRecord = local.disc[String(id)]
  const apiRecord = catalogs.characters.get(id) ?? catalogs.discs.get(id)
  const names = buildNames(local.loaders, item.Title, 'item')
  const element = ELEMENT_NAMES[Number((disc ? discRecord : character)?.EET ?? 0)] ?? null
  const iconFile = assetFile(item.Icon)
  const cnIcon = iconFile ? `${iconFile}${disc ? '_b' : ''}.webp` : null
  return {
    id,
    name: names.CN ?? apiRecord?.name ?? `Goods ${id}`,
    i18n: { name: names },
    element,
    kind: disc ? 'disc' : 'trekker',
    rarity: RARITY_STARS[Number(item.Rarity)] ?? 3,
    group: 'ssr',
    featured: false,
    icon: apiRecord?.icon ?? assetName(item.Icon, disc ? '_b' : ''),
    portrait: apiRecord?.portrait ?? null,
    cnIcon,
    cnDir: disc ? 'outfit' : 'head'
  }
}

/** 按游戏逻辑把物品分桶 */
function bucketOf(entry) {
  if (entry.kind === 'trekker') return entry.rarity >= 5 ? 'ssrChar' : 'srChar'
  if (entry.rarity >= 5) return 'ssrDisc'
  if (entry.rarity === 4) return 'srDisc'
  return 'rDisc'
}

const GROUP_OF_BUCKET = {
  ssrChar: 'ssr',
  ssrDisc: 'ssr',
  srChar: 'sr',
  srDisc: 'sr',
  rDisc: 'r'
}

/** 按游戏公式计算各卡包概率 */
function buildPkgProbabilities(gacha, local) {
  const storage = local.storage[String(gacha.StorageId)] ?? {}
  const group = Number(storage.ATypeGroup ?? 0)
  const aRow = Object.values(local.aTypeProb)
    .find((row) => Number(row.Group) === group && Number(row.Times ?? 0) === 0)
  const total = Number(aRow?.Prob ?? 0)
  const bProb = Number(storage.BTypeProb ?? 0)
  const aUp = Number(storage.ATypeUpProb ?? 0)
  const bUp = Number(storage.BTypeUpProb ?? 0)
  const bGuarantee = Number(storage.BTypeGuaranteeProb ?? 0)
  const cProb = 10000 - total - bProb
  return {
    ATypeUpPkg: (total * aUp) / 10000,
    ATypePkg: total * (1 - aUp / 10000),
    BTypeUpPkg: (bProb * bUp) / 10000,
    BGuaranteePkg: (bProb * bGuarantee) / 10000,
    BTypePkg: bProb * (1 - (bUp + bGuarantee) / 10000),
    CTypePkg: cProb
  }
}

/** 按货物 id 去重 保留首次顺序并合并概率与 UP 标记 */
function dedupeGoods(entries) {
  const merged = new Map()
  for (const entry of entries) {
    const prev = merged.get(entry.id)
    if (!prev) {
      merged.set(entry.id, { ...entry })
      continue
    }
    prev.prob += entry.prob || 0
    prev.featured = prev.featured || entry.featured
  }
  return [...merged.values()]
}

/** 生成货物清单 顺序与游戏一致 */
function buildLocalGoods(gacha, local, catalogs) {
  const pkgProb = buildPkgProbabilities(gacha, local)
  const definitions = [
    { field: 'ATypeUpPkg', featured: true },
    { field: 'BTypeUpPkg', featured: true },
    { field: 'ATypePkg', featured: false },
    { field: 'BTypePkg', featured: false },
    { field: 'BGuaranteePkg', featured: false },
    { field: 'CTypePkg', featured: false }
  ]
  const buckets = { ssrChar: [], srChar: [], ssrDisc: [], srDisc: [], rDisc: [] }
  const upEntries = []
  const poolEntries = []

  for (const definition of definitions) {
    const rows = local.packages.get(Number(gacha[definition.field] ?? 0)) ?? []
    if (rows.length === 0) continue
    const totalWeight = rows.reduce((sum, row) => sum + (row.weight || 1), 0)
    const share = Number(pkgProb[definition.field] ?? 0)
    for (const row of rows) {
      const prob = ((row.weight || 1) / totalWeight) * share / 10000 * 100
      const entry = { ...makeGoodsEntry(row.id, local, catalogs), featured: definition.featured, prob }
      if (definition.featured) upEntries.push(entry)
      else poolEntries.push(entry)
    }
  }

  upEntries.sort(compareGameGoods)
  poolEntries.sort(compareGameGoods)
  for (const entry of upEntries) buckets[bucketOf(entry)].push(entry)
  for (const entry of poolEntries) buckets[bucketOf(entry)].push(entry)

  const order = ['ssrChar', 'ssrDisc', 'srChar', 'srDisc', 'rDisc']
  return dedupeGoods(order.flatMap((bucket) => buckets[bucket].map((entry) => ({ ...entry, group: GROUP_OF_BUCKET[bucket] }))))
}

/** 按时间窗口判定卡池分组 */
function getBucket(startTime, endTime, permanent) {
  if (permanent) return 'permanent'
  const now = Date.now()
  const start = startTime ? Date.parse(startTime) : null
  const end = endTime ? Date.parse(endTime) : null
  if (start !== null && now < start) return 'upcoming'
  if (end !== null && now > end) return 'ended'
  return 'current'
}

/** 按游戏规则拼出 UP 货物展示名 属性·名称 */
function contentNameOf(local, id, lang) {
  const item = local.item[String(id)] ?? {}
  const disc = isDiscItem(item)
  const record = disc ? local.disc[String(id)] : local.character[String(id)]
  const eet = Number(record?.EET ?? 0)
  const element = local.loaders[lang]?.uiText?.[`UIText.T_Element_Attr_${eet}.1`]
    ?? local.loaders.CN?.uiText?.[`UIText.T_Element_Attr_${eet}.1`]
    ?? ''
  const key = disc ? item.Title : (record?.Name ?? item.Title)
  const nameTable = local.loaders[lang]?.[disc ? 'item' : 'character'] ?? local.loaders.CN?.[disc ? 'item' : 'character']
  const fallbackTable = local.loaders.CN?.[disc ? 'item' : 'character']
  const name = lookupText(nameTable, key, fallbackTable) ?? ''
  return element ? `${element}·${name}` : name
}

/** 生成单个卡池数据 */
function buildNotes(loaders, typeRecord, nameI18n, gacha, local) {
  const mainUpId = (local.packages.get(Number(gacha.ATypeUpPkg ?? 0)) ?? [])[0]?.id
  const subUpIds = (local.packages.get(Number(gacha.BTypeUpPkg ?? 0)) ?? []).map((row) => row.id)
  const notes = {}
  for (const lang of LANGUAGES) {
    const table = loaders[lang]?.gachaType ?? {}
    const text = (field) => {
      const key = typeRecord?.[field]
      return key ? (table[key] ?? '') : ''
    }
    const upFive = mainUpId !== undefined ? contentNameOf(local, mainUpId, lang) : ''
    const upFour = subUpIds.slice(0, 2).map((id) => contentNameOf(local, id, lang))
    const values = [nameI18n[lang] ?? '', upFive, upFour[0] ?? '', upFour[1] ?? '']
    const sections = []
    for (const index of [1, 2, 3]) {
      const body = text(`Desc${index}`)
      if (!body) continue
      let resolved = body
      values.forEach((value, idx) => { resolved = resolved.replaceAll(`{${idx}}`, value) })
      sections.push({ title: text(`Title${index}`), body: resolved })
    }
    notes[lang] = {
      upTitle: text('Title4'),
      upFiveRate: text('Desc4'),
      upFourRate: text('Desc5'),
      listTitle: text('Title5'),
      groups: {
        ssr: text('Desc6'),
        sr: text('Desc7'),
        r: text('Desc8')
      },
      sections
    }
  }
  return notes
}

/** 常驻池历期包构成 用于入常驻时间线 */
function poolSnapshotOf(gacha, local) {
  if (![2, 4, 6, 7].includes(Number(gacha.GachaType))) return null
  const ids = (pkgId) => (local.packages.get(Number(pkgId)) ?? []).map((row) => row.id)
  const gachaType = Number(gacha.GachaType)
  const isTrekker = gachaType === 2 || gachaType === 6
  return {
    gachaType: isTrekker ? 2 : 4,
    fiveStar: ids(gacha.ATypePkg),
    up: ids(isTrekker ? gacha.ATypeUpPkg : gacha.BTypeUpPkg),
    fourStar: ids(isTrekker ? gacha.BGuaranteePkg : gacha.BTypePkg)
  }
}

function buildLocalBanner(gacha, local, catalogs, apiBannerMap) {
  const id = Number(gacha.Id)
  const apiBanner = apiBannerMap.get(id) ?? {}
  const typeRecord = local.gachaType[String(gacha.GachaType)] ?? {}
  const startTime = gacha.StartTime || apiBanner.startTime || null
  const endTime = gacha.EndTime || apiBanner.endTime || null
  const permanent = !startTime && !endTime
  const tabIcon = assetName(gacha.Icon) ?? assetFile(apiBanner.assets?.tabIcon)
  const banner = assetName(gacha.BannerRes) ?? assetFile(apiBanner.assets?.banner)
  const cover = assetName(gacha.Image) ?? assetFile(apiBanner.assets?.cover)
  const classification = classifyGacha(gacha)
  const nameI18n = buildNames(local.loaders, gacha.Name, 'gacha')
  const typeI18n = buildNames(local.loaders, typeRecord.Name, 'gachaType')
  const goods = buildLocalGoods(gacha, local, catalogs)
  const poolSnapshot = poolSnapshotOf(gacha, local)
  return {
    id,
    name: nameI18n.CN ?? apiBanner.name ?? `Banner ${id}`,
    i18n: { name: nameI18n, type: typeI18n },
    type: typeI18n.CN ?? apiBanner.type ?? 'Recruitment Banner',
    ...classification,
    bucket: getBucket(startTime, endTime, permanent),
    permanent,
    startTime,
    endTime,
    sort: Number(gacha.Sort ?? 0),
    assets: {
      banner,
      tabIcon,
      cover,
      display: banner ?? tabIcon ?? cover
    },
    rateUp: {
      fiveStar: Number(gacha.ATypeUpPkg ?? 0) || null,
      fourStar: Number(gacha.BTypeUpPkg ?? 0) || null
    },
    goods,
    poolSnapshot,
    notes: buildNotes(local.loaders, typeRecord, nameI18n, gacha, local)
  }
}

/** 归一化接口物品 兜底用 */
function normalizeApiGoods(entry, tier, catalogs) {
  const id = Number(entry.id)
  const character = catalogs.characters.get(id)
  const disc = catalogs.discs.get(id)
  const record = character ?? disc
  const group = tier === 'fiveStar' ? 'ssr' : 'sr'
  const name = entry.name ?? record?.name ?? `Goods ${id}`
  const names = Object.fromEntries(LANGUAGES.map((lang) => [lang, name]))
  return {
    id,
    name,
    i18n: { name: names },
    element: entry.element ?? record?.element ?? null,
    kind: disc ? 'disc' : 'trekker',
    rarity: tier === 'fiveStar' ? 5 : 4,
    group,
    featured: true,
    icon: assetFile(record?.icon) ?? `${entry.name}.png`,
    portrait: assetFile(record?.portrait) ?? null,
    cnIcon: null,
    cnDir: null,
    prob: 0
  }
}

/** 归一化接口卡池 兜底用 */
function normalizeApiBanner(bucket, banner, catalogs) {
  const rateUp = banner.rateUp ?? {}
  const goods = []
  for (const tier of ['fiveStar', 'fourStar']) {
    for (const entry of rateUp[tier]?.entries ?? []) goods.push(normalizeApiGoods(entry, tier, catalogs))
  }
  const assets = banner.assets ?? {}
  const name = banner.name ?? `Banner ${banner.id}`
  const type = banner.bannerType ?? 'Recruitment Banner'
  const names = Object.fromEntries(LANGUAGES.map((lang) => [lang, name]))
  const apiKind = /disc|record|秘纹|秘聞/i.test(type) ? 'disc'
    : /trekker|character|旅人/i.test(type) ? 'trekker' : 'mixed'
  return {
    id: Number(banner.id),
    name,
    i18n: { name: names, type: names },
    type,
    category: 'standard',
    badges: ['standard'],
    isRerun: false,
    gachaType: 0,
    storageId: 0,
    poolKind: apiKind,
    bucket,
    permanent: Boolean(banner.permanent),
    startTime: banner.startTime ?? null,
    endTime: banner.endTime ?? null,
    sort: Number(banner.Sort ?? 0),
    assets: {
      banner: assetFile(assets.banner),
      tabIcon: assetFile(assets.tabIcon),
      cover: assetFile(assets.cover),
      display: assetFile(assets.banner ?? assets.tabIcon ?? assets.cover)
    },
    rateUp: {
      fiveStar: rateUp.fiveStar?.packageId ?? null,
      fourStar: rateUp.fourStar?.packageId ?? null
    },
    goods,
    notes: null
  }
}

/** 同周期内旅人池排在秘纹池前 */
function typeRank(banner) {
  if (banner.poolKind === 'disc') return 1
  if (banner.poolKind === 'mixed') return 0.5
  return 0
}

/** 取卡池比较用时间 */
function timeValue(banner) {
  const value = banner.bucket === 'ended'
    ? banner.endTime ?? banner.startTime
    : banner.startTime ?? banner.endTime
  return value ? Date.parse(value) : 0
}

/** 卡池排序规则 */
function compareBanners(a, b) {
  const bucketDiff = buckets.indexOf(a.bucket) - buckets.indexOf(b.bucket)
  if (bucketDiff !== 0) return bucketDiff
  const timeDiff = timeValue(b) - timeValue(a)
  if (a.bucket === 'current') return compareCurrentPools(a, b)
  if (a.bucket === 'upcoming') {
    const typeDiff = typeRank(a) - typeRank(b)
    if (typeDiff !== 0) return typeDiff
    if (timeDiff !== 0) return timeDiff
  } else {
    if (timeDiff !== 0) return timeDiff
    const typeDiff = typeRank(a) - typeRank(b)
    if (typeDiff !== 0) return typeDiff
  }
  return b.sort - a.sort || b.id - a.id
}

/** 写出卡池数据文件 */
async function writeData(data) {
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

const snapshot = await readSnapshot()
const requests = await Promise.allSettled([
  fetchJson('/banners'),
  fetchJson('/characters'),
  fetchJson('/discs')
])

const characterRecords = requests[1].status === 'fulfilled'
  ? requests[1].value
  : snapshot?.catalogs?.characters ?? []
const discRecords = requests[2].status === 'fulfilled'
  ? requests[2].value
  : snapshot?.catalogs?.discs ?? []

const catalogs = {
  characters: new Map(characterRecords.map((record) => [Number(record.id), compactCharacter(record)])),
  discs: new Map(discRecords.map((record) => [Number(record.id), compactDisc(record)]))
}

const apiBannerMap = new Map()
if (requests[0].status === 'fulfilled') {
  for (const bucket of buckets) {
    for (const banner of requests[0].value[bucket] ?? []) {
      apiBannerMap.set(Number(banner.id), banner)
    }
  }
}

let local = null
if (localDataDir) {
  try {
    local = await loadLocalData(localDataDir)
    console.log('Using local gacha data')
  } catch (error) {
    console.log('Local gacha data unavailable', error.message)
  }
}

let banners = []
let dataSource = 'snapshot'

if (local) {
  banners = Object.values(local.gacha)
    .map((gacha) => buildLocalBanner(gacha, local, catalogs, apiBannerMap))
    .sort(compareBanners)
  dataSource = 'local'
} else if (apiBannerMap.size > 0) {
  banners = buckets.flatMap((bucket) => {
    return (requests[0].value[bucket] ?? []).map((banner) => normalizeApiBanner(bucket, banner, catalogs))
  }).sort(compareBanners)
  dataSource = 'api'
  console.log('Using API gacha data')
} else if (snapshot?.banners?.length) {
  console.log('Using cached gacha snapshot')
  process.exit(0)
}

/** 当期排序 UP 优先 复刻随后 */
function compareCurrentPools(a, b) {
  if (a.isRerun !== b.isRerun) return a.isRerun ? 1 : -1
  const kindDiff = typeRank(a) - typeRank(b)
  if (kindDiff !== 0) return kindDiff
  return timeValue(b) - timeValue(a) || b.sort - a.sort || b.id - a.id
}

/** 选取首屏主推卡池 */
const featured = banners.find((banner) => banner.bucket === 'current' && !banner.isRerun && banner.poolKind === 'trekker')
  ?? banners.find((banner) => banner.bucket === 'current' && !banner.isRerun)
  ?? banners.find((banner) => banner.bucket === 'current')
  ?? banners.find((banner) => banner.bucket === 'upcoming')
  ?? banners[0]

if (!featured) throw new Error('No banner records found')

const data = {
  language: 'CN',
  languages: LANGUAGES,
  dataSource,
  generatedAt: snapshot?.generatedAt ?? new Date().toISOString(),
  source: apiBase,
  featuredId: featured.id,
  banners,
  catalogs: {
    characters: Array.from(catalogs.characters.values()),
    discs: Array.from(catalogs.discs.values())
  }
}

/** 忽略生成时间的比对 数据没变就不刷新时间戳 */
const contentKey = (value) => JSON.stringify({ ...value, generatedAt: '' })
if (snapshot && contentKey(snapshot) !== contentKey(data)) data.generatedAt = new Date().toISOString()

await writeData(data)
console.log(`Prepared ${banners.length} banners`)
console.log(`Featured banner ${featured.name}`)
console.log('Wrote gacha data')
