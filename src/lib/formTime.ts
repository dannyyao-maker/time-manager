// 新增頁的時間小工具

const pad = (n: number) => String(n).padStart(2, '0')

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 55, total))
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

// 改開始時間時，結束時間跟著移動、維持原本的長度（沒有結束時間就預設 1 小時）
// 只在同一天的項目這樣做；超過 23:55 就停在 23:55
export function shiftEnd(oldStart: string, newStart: string, end: string, sameDay: boolean): string {
  if (!sameDay) return end
  const length = end && oldStart ? toMinutes(end) - toMinutes(oldStart) : 60
  return fromMinutes(toMinutes(newStart) + (length > 0 ? length : 60))
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 精簡的日期：「11/10（二）」；不是今年才加年份
export function chipDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  const year = y !== new Date().getFullYear() ? `${y}/` : ''
  return `${year}${m}/${d}（${wd}）`
}
