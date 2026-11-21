import type { Lang } from '../lib/i18n'
import { LANGUAGES, languageMeta, saveLanguage, t } from '../lib/i18n'
import {
  dialog, getFilter, getLang, historyDialog, nameOf, searchInput, setActiveTab, setLang, setSearch
} from './state'
import { applyTheme, switchTheme } from './theme'
import { applyRegionImages, bindImageFallbacks } from './images'
import { applyFilters, regroupCards, updateLiveState, updateSinceCounters } from './cards'
import { refreshDialog } from './dialog'
import { closeHistoryDialog, openHistoryDialog } from './history'
import { closeRateDialog, openRateDialog } from './dialog'

/** 将当前语言应用到所有节点 */
function applyLanguage(): void {
  const lang = getLang()
  const html = document.documentElement
  html.lang = languageMeta[lang].htmlLang
  html.dataset.lang = lang

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n ?? ''
    const params = JSON.parse(element.dataset.params ?? '{}')
    element.textContent = t(lang, key, params)
  })
  document.querySelectorAll<HTMLElement>('[data-localized-name]').forEach((element) => {
    element.textContent = nameOf(element, element.textContent ?? '')
  })
  for (const button of document.querySelectorAll<HTMLElement>('[data-lang-button]')) {
    button.classList.toggle('is-active', button.dataset.langButton === lang)
  }
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder ?? ''
    element.setAttribute('placeholder', t(lang, key))
  })

  updateLiveState()
  updateSinceCounters()
  regroupCards()
  applyTheme()
  applyRegionImages()
  refreshDialog()
  bindImageFallbacks()
}

/** 切换界面语言 */
function switchLanguage(next: Lang): void {
  if (!LANGUAGES.includes(next)) return
  setLang(next)
  saveLanguage(next)
  applyLanguage()
}

/** 绑定图鉴切换栏 */
function bindRosterTabs(): void {
  const tabs = document.querySelectorAll<HTMLElement>('[data-roster-tab]')
  if (tabs.length === 0) return
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.rosterTab ?? ''
      tabs.forEach((item) => item.classList.toggle('is-active', item === tab))
      document.querySelectorAll<HTMLElement>('[data-roster-panel]').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.rosterPanel === key)
      })
    })
  })
}

/** 查找覆盖目标日期的期卡片 */
function findTargetCard(target: number): HTMLElement | null {
  const cards = [...document.querySelectorAll<HTMLElement>('.period-card')]
    .map((card) => ({ card, start: Date.parse(card.dataset.periodStart ?? ''), end: Date.parse(card.dataset.periodEnd ?? '') }))
    .filter((item) => !Number.isNaN(item.start) && !Number.isNaN(item.end))
    .sort((a, b) => b.start - a.start)
  if (cards.length === 0) return null

  const exact = cards.find((item) => target >= item.start && target <= item.end)?.card
  if (exact) return exact

  const monthStart = new Date(target).setDate(1)
  const monthEnd = new Date(target).setMonth(new Date(target).getMonth() + 1, 1)
  const inMonth = cards.filter((item) => item.start >= monthStart && item.start < monthEnd)
  const monthMatch = (inMonth.length > 0 ? inMonth[inMonth.length - 1].card : null)
    ?? cards.find((item) => item.start <= target && item.end >= monthStart)?.card
  if (monthMatch) return monthMatch

  const yearStart = new Date(target).setMonth(0, 1)
  const yearEnd = new Date(target).setFullYear(new Date(target).getFullYear() + 1, 0, 1)
  const inYear = cards.filter((item) => item.start >= yearStart && item.start < yearEnd)
  const yearMatch = (inYear.length > 0 ? inYear[0].card : null)
    ?? cards.find((item) => item.start <= target && item.end >= yearStart)?.card
  if (yearMatch) return yearMatch

  const maxYear = new Date(cards[0].start).getFullYear()
  const minYear = new Date(cards[cards.length - 1].start).getFullYear()
  const chosenYear = new Date(target).getFullYear()
  return chosenYear > maxYear ? cards[0].card : chosenYear < minYear ? cards[cards.length - 1].card : null
}

/** 绑定日期跳转面板 */
function bindDateJump(): void {
  const toggle = document.querySelector<HTMLElement>('[data-date-toggle]')
  const panel = document.querySelector<HTMLElement>('[data-date-panel]')
  const input = document.querySelector<HTMLInputElement>('[data-date-input]')
  const go = document.querySelector<HTMLElement>('[data-date-go]')
  if (!toggle || !panel || !input || !go) return

  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden })
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    if (!event.target.closest('.date-jump')) panel.hidden = true
  })
  const jump = () => {
    if (!input.value) return
    const target = Date.parse(input.value + 'T12:00:00+08:00')
    if (Number.isNaN(target)) return
    const best = findTargetCard(target)
    panel.hidden = true
    if (!best) return
    best.scrollIntoView({ behavior: 'smooth', block: 'center' })
    best.classList.add('is-flash')
    window.setTimeout(() => best.classList.remove('is-flash'), 2400)
  }
  go.addEventListener('click', jump)
  input.addEventListener('change', jump)
}

/** 绑定返回顶部按钮 */
function bindBackToTop(): void {
  const button = document.querySelector<HTMLElement>('[data-back-to-top]')
  if (!button) return
  const sync = () => { button.hidden = window.scrollY < 480 }
  sync()
  window.addEventListener('scroll', sync, { passive: true })
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

/** 处理事件委托点击 */
function handleDocumentClick(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return
  const target = event.target

  if (target.closest('[data-theme-toggle]')) {
    switchTheme()
    return
  }
  const langButton = target.closest<HTMLElement>('[data-lang-button]')
  if (langButton) {
    switchLanguage(langButton.dataset.langButton as Lang)
    return
  }
  const tabButton = target.closest<HTMLElement>('[data-dialog-tab]')
  if (tabButton) {
    setActiveTab(tabButton.dataset.dialogTab === 'probability' ? 'probability' : 'goods')
    refreshDialog()
    return
  }
  const historyButton = target.closest<HTMLElement>('[data-action="history"]')
  if (historyButton) {
    openHistoryDialog(Number(historyButton.dataset.entryIndex))
    return
  }
  if (target.closest('[data-action="close-history"]')) {
    closeHistoryDialog()
    return
  }
  const details = target.closest<HTMLElement>('[data-action="details"]')
  if (details) {
    openRateDialog(Number(details.dataset.bannerId))
    return
  }
  if (target.closest('[data-action="close-dialog"]')) {
    closeRateDialog()
    return
  }
  const filter = target.closest<HTMLElement>('[data-filter]')
  if (filter) applyFilters(filter.dataset.filter ?? getFilter())
}

/** 初始化页面行为 */
function init(): void {
  applyTheme()
  applyLanguage()
  regroupCards()
  applyFilters()
  bindImageFallbacks()

  const input = searchInput
  input?.addEventListener('input', () => {
    const value = input.value.trim().toLowerCase()
    setSearch(value)
    applyFilters()
  })
  searchClearClick()
  bindBackToTop()
  bindDateJump()
  bindRosterTabs()
  document.addEventListener('click', handleDocumentClick)
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closeRateDialog()
  })
  historyDialog?.addEventListener('click', (event) => {
    if (event.target === historyDialog) closeHistoryDialog()
  })
  window.setInterval(() => {
    updateLiveState()
    regroupCards()
    applyFilters()
  }, 60000)
  window.setInterval(updateSinceCounters, 1000)
}

/** 绑定搜索清除按钮 */
function searchClearClick(): void {
  const clear = document.querySelector<HTMLElement>('[data-search-clear]')
  clear?.addEventListener('click', () => {
    if (searchInput) searchInput.value = ''
    setSearch('')
    applyFilters()
    searchInput?.focus()
  })
}

init()
