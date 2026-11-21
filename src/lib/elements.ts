/** 图标名来自 AllEnum Star_Element */
const elementMap: Record<string, { label: string, short: string, tone: string, icon: string }> = {
  aqua: { label: 'Aqua', short: 'Aq', tone: 'aqua', icon: 'element-water.png' },
  ignis: { label: 'Ignis', short: 'Ig', tone: 'ignis', icon: 'element-fire.png' },
  terra: { label: 'Terra', short: 'Te', tone: 'terra', icon: 'element-earth.png' },
  ventus: { label: 'Ventus', short: 'Ve', tone: 'ventus', icon: 'element-wind.png' },
  lux: { label: 'Lux', short: 'Lu', tone: 'lux', icon: 'element-light.png' },
  umbra: { label: 'Umbra', short: 'Um', tone: 'umbra', icon: 'element-dark.png' },
  none: { label: 'None', short: '—', tone: 'none', icon: 'element-none.png' }
}

/** 解析属性展示信息 */
export function elementInfo(element: string | null): { label: string, short: string, tone: string, icon: string } {
  if (!element) return elementMap.none
  return elementMap[element.toLowerCase()] ?? {
    label: element,
    short: element.slice(0, 2).toUpperCase(),
    tone: 'none',
    icon: 'element-none.png'
  }
}
