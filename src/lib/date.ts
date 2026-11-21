import type { BannerEntry } from './types'
import { t, type Lang } from './i18n'

export type BannerStatus = 'ongoing' | 'upcoming' | 'ended' | 'permanent'

const dayMs = 86400000
const hourMs = 3600000

/** 解析卡池实时状态 */
export function getBannerStatus(banner: BannerEntry, now: Date = new Date()): BannerStatus {
  if (banner.permanent || (!banner.startTime && !banner.endTime)) return 'permanent'
  const start = banner.startTime ? Date.parse(banner.startTime) : null
  const end = banner.endTime ? Date.parse(banner.endTime) : null
  if (start !== null && now.getTime() < start) return 'upcoming'
  if (end !== null && now.getTime() > end) return 'ended'
  return 'ongoing'
}

/** 按游戏时区与语言格式化日期 */
export function formatDate(value: string | null, lang: Lang = 'CN', timeZone = 'Asia/Shanghai'): string {
  if (!value) return t(lang, 'live.permanent')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t(lang, 'live.permanent')
  const locale = lang === 'CN' ? 'zh-CN' : lang === 'TW' ? 'zh-TW' : lang === 'JP' ? 'ja-JP' : lang === 'KR' ? 'ko-KR' : 'en-US'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone
  }).format(date)
}

/** 格式化卡池周期 不含相对时间 */
export function formatPeriod(banner: BannerEntry, lang: Lang = 'CN'): string {
  if (banner.permanent || (!banner.startTime && !banner.endTime)) return t(lang, 'status.permanent')
  const start = formatDate(banner.startTime, lang)
  const end = banner.endTime ? formatDate(banner.endTime, lang) : '—'
  return `${start} ~ ${end}`
}

/** 生成单位文案 */
function unitLabel(value: number, unit: string): string {
  return `${value} ${unit}`
}

/** 格式化卡池剩余或开始时间 */
export function formatRelative(banner: BannerEntry, now: Date = new Date(), lang: Lang = 'CN'): string {
  const status = getBannerStatus(banner, now)
  if (status === 'permanent') return t(lang, 'live.permanent')

  const start = banner.startTime ? Date.parse(banner.startTime) : null
  const end = banner.endTime ? Date.parse(banner.endTime) : null
  if (status === 'upcoming' && start !== null) {
    const days = Math.max(1, Math.ceil((start - now.getTime()) / dayMs))
    return `${t(lang, 'live.upcoming')} ${unitLabel(days, lang === 'EN' ? (days === 1 ? 'day' : 'days') : lang === 'JP' ? '日' : lang === 'KR' ? '일' : '天')}`
  }
  if (status === 'ended') return t(lang, 'live.ended')
  if (end !== null) {
    const diff = Math.max(0, end - now.getTime())
    if (diff < dayMs) {
      const hours = Math.max(1, Math.floor(diff / hourMs))
      return `${t(lang, 'live.ongoing')} ${unitLabel(hours, lang === 'EN' ? (hours === 1 ? 'hour' : 'hours') : lang === 'JP' ? '時間' : lang === 'KR' ? '시간' : '小时')}`
    }
    const days = Math.floor(diff / dayMs)
    return `${t(lang, 'live.ongoing')} ${unitLabel(days, lang === 'EN' ? (days === 1 ? 'day' : 'days') : lang === 'JP' ? '日' : lang === 'KR' ? '일' : '天')}`
  }
  return t(lang, 'live.permanent')
}

/** 输出状态文案 */
export function statusText(status: BannerStatus, lang: Lang = 'CN'): string {
  return t(lang, `status.${status}`)
}

/** 计算卡池进度百分比 */
export function bannerProgress(banner: BannerEntry, now: Date = new Date()): number {
  const start = banner.startTime ? Date.parse(banner.startTime) : null
  const end = banner.endTime ? Date.parse(banner.endTime) : null
  if (start === null || end === null || end <= start) return 0
  const raw = ((now.getTime() - start) / (end - start)) * 100
  return Math.min(100, Math.max(0, raw))
}
