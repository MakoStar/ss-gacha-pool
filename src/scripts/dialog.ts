import { goodsCardHtml, rankStarsHtml } from '../lib/card'
import { elementInfo } from '../lib/elements'
import { localized, t } from '../lib/i18n'
import { stelladbUrl } from '../lib/data'
import { formatPeriod } from '../lib/date'
import type { BannerEntry, GoodsEntry, GoodsGroup } from '../lib/types'
import {
  dialog, dialogBody, dialogFooter, escapeHtml, findBanner,
  getActiveBanner, getActiveTab, getLang, GOODS_GROUPS, groupI18n,
  setActiveBanner, setActiveTab
} from './state'
import { bindImageFallbacks } from './images'

/** 把官方说明转成高亮 HTML */
function formatNoteText(text: string): string {
  return escapeHtml(text)
    .replace(/&lt;color=#[0-9a-fA-F]{6}&gt;([\s\S]*?)&lt;\/color&gt;/g, '<span class="note-hl">$1</span>')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** 渲染单个卡片单元 点击跳转 stelladb */
function renderGridIcon(goods: GoodsEntry): string {
  const lang = getLang()
  const name = localized(goods.i18n?.name, lang) || goods.name
  const href = stelladbUrl(goods)
  return `<div class="card-cell"><a class="card-link" href="${href}" target="_blank" rel="noreferrer" title="${escapeHtml(name)}">${goodsCardHtml(goods, { lang, eager: true })}</a><span class="card-cell-name">${escapeHtml(name)}</span></div>`
}

/** 渲染 UP 区星级与概率文案 */
function renderUpGroup(items: GoodsEntry[], rarity: number, rateText?: string): string {
  return `
    <div class="up-row">
      <div class="up-line">
        ${rankStarsHtml(rarity)}
        <span class="up-rate">${escapeHtml(rateText ?? '')}</span>
      </div>
      <div class="card-grid card-grid-up">${items.map(renderGridIcon).join('')}</div>
    </div>
  `
}

/** 渲染货物清单 UP 区与三段物品列表 */
function renderGoodsGrid(banner: BannerEntry): string {
  const lang = getLang()
  const notes = banner.notes?.[lang]
  const upFive = banner.goods.filter((goods) => goods.featured && goods.rarity >= 5)
  const upFour = banner.goods.filter((goods) => goods.featured && goods.rarity < 5)
  let html = ''

  if (upFive.length || upFour.length) {
    html += `<section class="panel-section">`
    html += `<h4 class="panel-heading">${escapeHtml(notes?.upTitle || t(lang, 'dialog.upTitle'))}</h4>`
    if (upFive.length) html += renderUpGroup(upFive, 5, notes?.upFiveRate)
    if (upFour.length) html += renderUpGroup(upFour, 4, notes?.upFourRate)
    html += '</section>'
  }

  const listTitle = notes?.listTitle || t(lang, 'dialog.listTitle')
  html += `<section class="panel-section">`
  html += `<h4 class="panel-heading">${escapeHtml(listTitle)}</h4>`
  for (const group of GOODS_GROUPS) {
    const items = banner.goods.filter((goods) => goods.group === group)
    if (items.length === 0) continue
    const label = notes?.groups?.[group] || t(lang, `dialog.group.${group}`)
    html += `<div class="panel-group">`
    html += `<div class="panel-group-head"><span>${escapeHtml(label)}</span><span class="panel-group-count">${items.length}</span></div>`
    html += `<div class="card-grid">${items.map(renderGridIcon).join('')}</div>`
    html += `</div>`
  }
  html += '</section>'

  for (const section of notes?.sections ?? []) {
    if (!section.title || !section.body) continue
    html += `<section class="panel-section panel-note"><h4 class="panel-heading">${escapeHtml(section.title)}</h4>`
    html += `<div class="panel-note-body">${formatNoteText(section.body)}</div></section>`
  }
  return html
}

/** 格式化掉率 保留五位小数 */
function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${value.toFixed(5)}%`
}

/** 计算分组掉率合计 */
function sumOf(banner: BannerEntry, group: GoodsGroup): number {
  return banner.goods
    .filter((goods) => goods.group === group)
    .reduce((sum, goods) => sum + (goods.prob || 0), 0)
}

/** 渲染概率详情页表格 */
function renderProbabilityTable(banner: BannerEntry): string {
  const lang = getLang()
  const notes = banner.notes?.[lang]
  const body = GOODS_GROUPS.map((group) => {
    const items = banner.goods.filter((goods) => goods.group === group)
    if (items.length === 0) return ''
    const label = notes?.groups?.[group] || t(lang, groupI18n[group])
    const total = items.reduce((sum, goods) => sum + (goods.prob || 0), 0)
    const head = `
      <tr class="prob-group">
        <th colspan="3" scope="rowgroup">${escapeHtml(label)}</th>
        <th class="prob-value">${formatRate(total)}</th>
      </tr>`
    const rows = items.map((goods) => {
      const element = elementInfo(goods.element)
      const name = localized(goods.i18n?.name, lang) || goods.name
      const kind = t(lang, goods.kind === 'disc' ? 'dialog.type.disc' : 'dialog.type.trekker')
      const stars = '★'.repeat(goods.rarity)
      return `
        <tr class="prob-row${goods.featured ? ' is-up' : ''}">
          <td class="prob-kind"><span class="kind-dot element-${element.tone}" aria-hidden="true"></span>${kind}</td>
          <td class="prob-rank rarity-${goods.rarity}">${stars}</td>
          <td class="prob-name">${escapeHtml(name)}${goods.featured ? '<span class="up-chip">UP</span>' : ''}</td>
          <td class="prob-value">${formatRate(goods.prob)}</td>
        </tr>`
    }).join('')
    return head + rows
  }).join('')

  const sum = banner.goods.reduce((acc, goods) => acc + (goods.prob || 0), 0)
  return `
    <div class="prob-summary">
      <div class="prob-summary-item"><span class="prob-summary-label">★5</span><b>${formatRate(sumOf(banner, 'ssr'))}</b></div>
      <div class="prob-summary-item"><span class="prob-summary-label">★4</span><b>${formatRate(sumOf(banner, 'sr'))}</b></div>
      <div class="prob-summary-item"><span class="prob-summary-label">★3</span><b>${formatRate(sumOf(banner, 'r'))}</b></div>
      <div class="prob-summary-item prob-summary-total"><span class="prob-summary-label">${escapeHtml(t(lang, 'dialog.rate.total'))}</span><b>${formatRate(sum)}</b></div>
    </div>
    <div class="prob-table-wrap">
      <table class="prob-table">
        <thead>
          <tr>
            <th class="prob-kind" data-i18n="dialog.type">${t(lang, 'dialog.type')}</th>
            <th class="prob-rank" data-i18n="dialog.rarity">${t(lang, 'dialog.rarity')}</th>
            <th class="prob-name" data-i18n="dialog.name">${t(lang, 'dialog.name')}</th>
            <th class="prob-value" data-i18n="dialog.rate">${t(lang, 'dialog.rate')}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `
}

/** 渲染弹窗内容与底栏 */
export function renderDialog(banner: BannerEntry | null): void {
  const lang = getLang()
  const tab = getActiveTab()
  if (!banner || !dialogBody || !dialogFooter) return
  const name = localized(banner.i18n?.name, lang) || banner.name
  dialogBody.innerHTML = tab === 'goods'
    ? `<div class="detail-list">${renderGoodsGrid(banner)}</div>`
    : renderProbabilityTable(banner)
  const period = formatPeriod(banner, lang)
  dialogFooter.innerHTML = `
    <span class="footer-name">${escapeHtml(name)}</span>
    <span class="footer-period"><b data-i18n="dialog.time">${t(lang, 'dialog.time')}</b> ${escapeHtml(period)}</span>
  `
  bindImageFallbacks(dialogBody)
  for (const item of document.querySelectorAll<HTMLElement>('[data-dialog-tab]')) {
    item.classList.toggle('is-active', item.dataset.dialogTab === tab)
  }
}

/** 打开卡池详情弹窗 */
export function openRateDialog(id: number, tab: 'goods' | 'probability' = 'goods'): void {
  const banner = findBanner(id)
  if (!banner || !dialog) return
  setActiveBanner(id)
  setActiveTab(tab)
  renderDialog(banner)
  dialog.showModal()
  dialogBody?.focus({ preventScroll: true })
}

/** 关闭卡池详情弹窗 */
export function closeRateDialog(): void {
  if (dialog?.open) dialog.close()
}

/** 重新渲染当前弹窗 */
export function refreshDialog(): void {
  renderDialog(findBanner(getActiveBanner()))
}
