// 日期工具：一律用台灣本地時間，不換算時區

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 「11月6日（週四）」；不是今年就加上年份
export function formatDateLabel(iso: string): string {
  const d = parseISODate(iso)
  const year = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}年` : ''
  return `${year}${d.getMonth() + 1}月${d.getDate()}日（週${WEEKDAYS[d.getDay()]}）`
}

// 「11/6」
export function formatShortDate(iso: string): string {
  const d = parseISODate(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 資料庫的 "10:20:00" → "10:20"
export function formatTime(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}
