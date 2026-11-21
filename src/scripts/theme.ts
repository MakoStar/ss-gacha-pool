import { t } from '../lib/i18n'
import { getLang, getTheme, setTheme, THEME_KEY } from './state'

/** 应用主题并刷新按钮文案 */
export function applyTheme(): void {
  const theme = getTheme()
  const lang = getLang()
  document.documentElement.dataset.theme = theme
  const button = document.querySelector<HTMLElement>('[data-theme-toggle]')
  if (!button) return
  button.title = t(lang, 'nav.theme')
  button.setAttribute('aria-label', t(lang, 'nav.theme'))
  const label = button.querySelector<HTMLElement>('[data-theme-label]')
  if (label) label.textContent = t(lang, theme === 'dark' ? 'theme.dark' : 'theme.light')
  const icon = button.querySelector<HTMLElement>('[data-theme-icon]')
  if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀'
}

/** 持久化并切换主题 */
export function switchTheme(): void {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
  try {
    localStorage.setItem(THEME_KEY, getTheme())
  } catch {
  }
  applyTheme()
}
