// 共同空檔：兩個人都沒有安排的時段（只在共用行事曆顯示）
//
// 規則（2026-11-07）：
//   - 只看每天 09:00–23:00
//   - 有時間的項目都算忙（兩人的個人行程、已經排好的約會都算）
//   - 跨好幾天的整天項目（例如回家、日本行）整天都算忙
//   - 單日的整天項目不算忙（通常是待辦，例如繳費、加退選）
//   - 沒寫結束時間的，當作佔 1 小時

import type { Occurrence } from '../data/types'
import { addDaysISO, diffDays } from './recurrence'

export const FREE_WINDOW = { startMinute: 9 * 60, endMinute: 23 * 60 }

export type FreeSlot = { date: string; start: string; end: string; minutes: number } // start／end：HH:MM

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// 某一筆項目在某一天佔掉的時間（以那天 0 點起算的分鐘；可能超過 24*60 代表跨到隔天）
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

// [from, to] 每一天的共同空檔（至少 minMinutes 分鐘）
export function freeSlots(occs: Occurrence[], from: string, to: string, minMinutes = 60): FreeSlot[] {
  const result: FreeSlot[] = []
  for (let day = from; day <= to; day = addDaysISO(day, 1)) {
    const busy = occs
      .map((o) => busyOnDay(o, day))
      .filter((x): x is [number, number] => !!x)
      .sort((a, b) => a[0] - b[0])
    let cursor = FREE_WINDOW.startMinute
    const push = (s: number, e: number) => {
      if (e - s >= minMinutes) result.push({ date: day, start: hhmm(s), end: hhmm(e), minutes: e - s })
    }
    for (const [s, e] of busy) {
      if (e <= cursor) continue
      if (s >= FREE_WINDOW.endMinute) break
      if (s > cursor) push(cursor, Math.min(s, FREE_WINDOW.endMinute))
      cursor = Math.max(cursor, e)
      if (cursor >= FREE_WINDOW.endMinute) break
    }
    if (cursor < FREE_WINDOW.endMinute) push(cursor, FREE_WINDOW.endMinute)
  }
  return result
}

// 月曆用：每一天最長的共同空檔有幾分鐘
export function longestFreeByDay(slots: FreeSlot[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of slots) map.set(s.date, Math.max(map.get(s.date) ?? 0, s.minutes))
  return map
}
