import { bannerChain } from '../lib/assets'
import { goodsCardHtml } from '../lib/card'
import type { GoodsEntry } from '../lib/types'
import { escapeHtml, historyBody, historyDialog, historyTitle } from './state'
import { bindImageFallbacks } from './images'

interface HistoryGoods {
  name: string
  icon: string | null
  cnIcon: string | null
  cnDir: 'head' | 'outfit' | null
  kind: string
  rarity: number
  element: string | null
}

interface HistoryNode {
  start: string
  end: string
  gap: number | null
  mainBannerId: number
  partnerBannerId: number | null
  mainBanner: string
  partnerBanner: string | null
  bannerFile: string | null
  partnerBannerFile: string | null
  mates: HistoryGoods[]
}

interface HistoryPayload {
  main: HistoryGoods
  partner: HistoryGoods | null
  count: number
  avgGap: number | null
  nodes: HistoryNode[]
}

let payload: HistoryPayload[] | null = null

/** 读取内联的时间树数据 */
function loadPayload(): HistoryPayload[] {
  if (payload) return payload
  const node = document.querySelector<HTMLScriptElement>('#history-payload')
  payload = node ? (JSON.parse(node.textContent ?? '[]') as HistoryPayload[]) : []
  return payload
}

/** 模态框节点的卡池 banner 缩略图 */
function historyBanner(file: string | null): string {
  const link = bannerChain(file, 'CN')
  if (!link) return ''
  const chain = link.chain.length > 0 ? ` data-img-chain="${encodeURIComponent(JSON.stringify(link.chain))}"` : ''
  return `<span class="ht-node-banner"><img src="${escapeHtml(link.src)}"${chain} data-fallback-name="卡池 banner" alt="卡池 banner" loading="lazy" decoding="async" /></span>`
}

/** 货物头像 HTML 模态框用 游戏原生卡面 */
function historyAvatar(goods: HistoryGoods): string {
  const entry = { ...goods, kind: goods.kind === 'disc' ? 'disc' : 'trekker' } as GoodsEntry
  return `<span class="ht-avatar">${goodsCardHtml(entry, { lang: 'CN', eager: true })}</span>`
}

/** 日期 带年份 2025/12/23 */
function formatDay(value: string): string {
  return value ? value.slice(0, 10).replaceAll('-', '/') : ''
}

/** 卡池持续天数 结束时间为空时不计算 */
function durationLabel(node: HistoryNode): string {
  if (!node.end) return ''
  const days = Math.max(1, Math.round((Date.parse(node.end) - Date.parse(node.start)) / 86400000))
  return `<em>总计 ${days} 天</em>`
}

/** 渲染时间树节点 */
function renderNode(node: HistoryNode, index: number, total: number): string {
  const gap = node.gap !== null ? `<em>间隔 ${node.gap} 天</em>` : '<em>首次 UP</em>'
  const span = durationLabel(node)
  const end = node.end ? formatDay(node.end) : '至今'
  const mates = node.mates.length > 0
    ? `<div class="ht-mates"><span class="ht-mates-label">同期陪跑</span>${node.mates.map((mate) => `<span class="ht-mate">${historyAvatar(mate)}<i>${escapeHtml(mate.name)}</i></span>`).join('')}</div>`
    : ''
  const mainLink = `<button type="button" class="ht-pool-link" data-action="details" data-banner-id="${node.mainBannerId}">${escapeHtml(node.mainBanner)}</button>`
  const partnerLink = node.partnerBannerId !== null && node.partnerBanner
    ? `<i>×</i><button type="button" class="ht-pool-link" data-action="details" data-banner-id="${node.partnerBannerId}">${escapeHtml(node.partnerBanner)}</button>`
    : ''
  return `<li class="ht-node${index === total - 1 ? ' is-last' : ''}">
    <span class="ht-dot"></span>
    <div class="ht-date">${formatDay(node.start)} – ${end} ${gap}${span}</div>
    <div class="ht-body">
      ${historyBanner(node.bannerFile)}
      <div class="ht-item">
        <div class="ht-pools">${mainLink}${partnerLink}</div>
        ${mates}
      </div>
    </div>
  </li>`
}

/** 打开登场时间树模态框 */
export function openHistoryDialog(index: number): void {
  if (!historyDialog || !historyBody || !historyTitle) return
  const entry = loadPayload()[index]
  if (!entry) return
  const pairName = entry.partner
    ? `${entry.main.name}<span class="sc-x">×</span>${entry.partner.name}`
    : entry.main.name
  historyTitle.textContent = '登场时间线'
  const kindPair = entry.partner
    ? `${entry.main.rarity}★ ${entry.main.kind === 'disc' ? '秘纹' : '旅人'} × ${entry.partner.rarity}★ ${entry.partner.kind === 'disc' ? '秘纹' : '旅人'}`
    : `${entry.main.rarity}★ ${entry.main.kind === 'disc' ? '秘纹' : '旅人'}`
  const stat = entry.avgGap !== null ? `平均间隔 ${entry.avgGap} 天` : `仅登场 ${entry.count} 期`
  const nodes = [...entry.nodes].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  const tree = nodes.map((node, nodeIndex) => renderNode(node, nodeIndex, nodes.length)).join('')
  historyBody.innerHTML = `
    <div class="ht-head">
      <span class="ht-avatars">${historyAvatar(entry.main)}${entry.partner ? historyAvatar(entry.partner) : ''}</span>
      <span class="ht-title"><strong>${pairName}</strong><small>${kindPair} · 登场 ${entry.count} 期</small></span>
      <span class="ht-stat">${stat}</span>
    </div>
    <ol class="ht-tree">${tree}</ol>`
  historyDialog.showModal()
  historyBody.focus({ preventScroll: true })
  bindImageFallbacks(historyBody)
}

/** 关闭登场时间树模态框 */
export function closeHistoryDialog(): void {
  historyDialog?.close()
}
