import { bannerProgress, formatPeriod, formatRelative, getBannerStatus, statusText } from '../lib/date'
import { findBanner, getFilter, getLang, getSearch, groupGrids, setFilter } from './state'

/** 按实时状态把卡片移入对应分组 */
export function regroupCards(): void {
  for (const card of document.querySelectorAll<HTMLElement>('.banner-card')) {
    if (card.closest('.current-section, .hero')) continue
    const target = groupGrids.get(card.dataset.status ?? '')
    if (target && card.parentElement !== target) target.appendChild(card)
  }
  for (const grid of groupGrids.values()) {
    const group = grid.closest<HTMLElement>('[data-group]')
    if (!group) continue
    const count = grid.querySelectorAll('.banner-card').length
    const countNode = group.querySelector<HTMLElement>('[data-group-count]')
    if (countNode) countNode.textContent = String(count)
    const emptyNode = group.querySelector<HTMLElement>('[data-group-empty]')
    if (emptyNode) emptyNode.hidden = count !== 0
    group.style.display = count === 0 ? 'none' : ''
  }
}

/** 刷新卡片状态周期与倒计时 */
export function updateLiveState(): void {
  const now = new Date()
  const lang = getLang()
  for (const card of document.querySelectorAll<HTMLElement>('[data-banner-card]')) {
    const banner = findBanner(Number(card.dataset.bannerId))
    if (!banner) continue
    const status = getBannerStatus(banner, now)
    const pill = card.querySelector<HTMLElement>('[data-status-pill]')
    const period = card.querySelector<HTMLElement>('[data-period]')
    const relative = card.querySelector<HTMLElement>('[data-relative]')
    const progress = card.querySelector<HTMLElement>('[data-progress]')
    card.dataset.status = status
    if (pill) {
      pill.textContent = statusText(status, lang)
      pill.dataset.statusText = status
    }
    if (period) period.textContent = formatPeriod(banner, lang)
    if (relative) relative.textContent = formatRelative(banner, now, lang)
    if (progress) progress.style.width = `${bannerProgress(banner, now)}%`
    for (const className of ['status-ongoing', 'status-upcoming', 'status-ended', 'status-permanent']) {
      card.classList.remove(className)
    }
    card.classList.add(`status-${status}`)
  }
}

/** 类型筛选条件 */
function matchesFilter(card: HTMLElement, filter: string): boolean {
  if (filter === 'all') return true
  const status = card.dataset.status ?? ''
  if (filter === 'ongoing') return status === 'ongoing'
  if (filter === 'upcoming') return status === 'upcoming'
  if (filter === 'ended') return status === 'ended'
  if (filter === 'permanent') return status === 'permanent'
  if (filter === 'trekker' || filter === 'disc') return card.dataset.kind === filter
  return (card.dataset.badges ?? '').split(',').filter(Boolean).includes(filter)
}

/** 应用类型筛选与搜索条件 */
export function applyFilters(filter = getFilter()): void {
  setFilter(filter)
  let visibleCount = 0
  if (groupGrids.size === 0) return
  const searchQuery = getSearch()

  for (const card of document.querySelectorAll<HTMLElement>('.archive-grid .banner-card')) {
    const visible = matchesFilter(card, filter)
      && (searchQuery === '' || (card.dataset.search ?? '').includes(searchQuery))
    card.classList.toggle('is-filtered', !visible)
    if (visible) visibleCount += 1
  }
  for (const button of document.querySelectorAll<HTMLElement>('[data-filter]')) {
    button.classList.toggle('is-active', button.dataset.filter === filter)
  }
  for (const grid of groupGrids.values()) {
    const group = grid.closest<HTMLElement>('[data-group]')
    if (!group) continue
    const shown = [...grid.querySelectorAll<HTMLElement>('.banner-card')]
      .filter((card) => !card.classList.contains('is-filtered')).length
    group.style.display = shown === 0 ? 'none' : ''
    const countNode = group.querySelector<HTMLElement>('[data-group-count]')
    if (countNode) countNode.textContent = String(shown)
    const emptyNode = group.querySelector<HTMLElement>('[data-group-empty]')
    if (emptyNode) emptyNode.hidden = shown !== 0
  }
  const archiveCount = document.querySelector<HTMLElement>('[data-archive-count]')
  if (archiveCount) archiveCount.textContent = String(visibleCount)
  const searchEmpty = document.querySelector<HTMLElement>('[data-search-empty]')
  if (searchEmpty) searchEmpty.hidden = visibleCount !== 0
  const searchClear = document.querySelector<HTMLElement>('[data-search-clear]')
  if (searchClear) searchClear.hidden = searchQuery === ''
}
