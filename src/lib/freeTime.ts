// 共同空檔：兩個人都沒有安排的時段（只在共用行事曆顯示）
//
// 規則（2026-11-07 調整）：
//   - 只看每天 12:00–22:00（中午以前、十點以後不算）
//   - 這段時間裡兩人都沒安排的時間「加起來」滿 5 小時（含），這天就算「可約」
//   - 有時間的項目都算忙（兩人的個人行程、已經排好的約會都算）
//   - 跨好幾天的整天項目（例如回家、日本行）整天都算忙
//   - 單日的整天項目不算忙（通常是待辦，例如繳費、加退選）
//   - 沒寫結束時間的，當作佔 1 小時

import type { Occurrence } from '../data/types'
import { addDaysISO, diffDays } from './recurrence'

export const FREE_WINDOW = { startMinute: 12 * 60, endMinute: 22 * 60 }
export const AVAILABLE_MINUTES = 5 * 60 // 一天至少空這麼久才算「可約」

export type FreeSlot = { date: string; start: string; end: string; minutes: number } // start／end：HH:MM

export type DayAvailability = {
  date: string
  slots: FreeSlot[] // 這天 12:00–22:00 的所有空檔
  totalMinutes: number // 空檔加起來幾分鐘
  available: boolean // 是否「可約」（加起來 ≥ 5 小時）
}

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// 某一筆項目在某一天佔掉的時間（以那天 0 點起算的分鐘）
function busyOnDay(o: Occurrence, day: string): [number, number] | null {
  if (day < o.start_date || day > o.end_date) return null
  if (!o.start_time) {
    // 整天：跨好幾天才算忙
    return o.end_date !== o.start_date ? [0, 24 * 60] : null
  }
  const dayOffset = diffDays(o.start_date, day) * 24 * 60 // 這天相對於開始那天差幾分鐘
  const start = toMin(o.start_time) - dayOffset
  let end: number
  if (o.end_time) end = diffDays(o.start_date, o.end_date) * 24 * 60 + toMin(o.end_time) - dayOffset
  else if (o.end_date !== o.start_date) end = (diffDays(o.start_date, o.end_date) + 1) * 24 * 60 - dayOffset
  else end = start + 60
  if (end <= start) end = start + 60
  const s = Math.max(0, start)
  const e = Math.min(24 * 60, end)
  return e > s ? [s, e] : null
}

// 某一天在 12:00–22:00 的空檔
export function dayAvailability(occs: Occurrence[], day: string): DayAvailability {
  const busy = occs
    .map((o) => busyOnDay(o, day))
    .filter((x): x is [number, number] => !!x)
    .sort((a, b) => a[0] - b[0])
  const slots: FreeSlot[] = []
  let cursor = FREE_WINDOW.startMinute
  const push = (s: number, e: number) => {
    if (e > s) slots.push({ date: day, start: hhmm(s), end: hhmm(e), minutes: e - s })
  }
  for (const [s, e] of busy) {
    if (e <= cursor) continue
    if (s >= FREE_WINDOW.endMinute) break
    if (s > cursor) push(cursor, Math.min(s, FREE_WINDOW.endMinute))
    cursor = Math.max(cursor, e)
    if (cursor >= FREE_WINDOW.endMinute) break
  }
  if (cursor < FREE_WINDOW.endMinute) push(cursor, FREE_WINDOW.endMinute)
  const totalMinutes = slots.reduce((sum, s) => sum + s.minutes, 0)
  return { date: day, slots, totalMinutes, available: totalMinutes >= AVAILABLE_MINUTES }
}

// [from, to] 每一天的空檔情況
export function availabilityRange(occs: Occurrence[], from: string, to: string): DayAvailability[] {
  const days: DayAvailability[] = []
  for (let d = from; d <= to; d = addDaysISO(d, 1)) days.push(dayAvailability(occs, d))
  return days
}

// 「接下來一週可約」：可約的日子裡，空最多的前幾天（再依日期排）
export function bestDays(days: DayAvailability[], limit = 3): DayAvailability[] {
  return days
    .filter((d) => d.available)
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.date.localeCompare(b.date))
    .slice(0, limit)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 「18:00–22:00、12:00–14:30」
export function slotsText(day: DayAvailability): string {
  return day.slots.map((s) => `${s.start}–${s.end}`).join('、')
}

// 「5.5 小時」
export function hoursText(minutes: number): string {
  const h = minutes / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} 小時`
}
