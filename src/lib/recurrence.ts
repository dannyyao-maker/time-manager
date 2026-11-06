// 重複行程：依規則算出每一次，並套用「單次覆寫」
// 重複項目在資料庫只存一筆；畫面上的每一次都是在這裡算出來的。

import type { Item, ItemInput, Occurrence, Override, RepeatFreq } from '../data/types'
import { parseISODate, toISODate } from './dates'

const DAY_MS = 24 * 60 * 60 * 1000

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS)
}

// 重複項目「原本」會發生在哪些日期（只算 [windowStart, windowEnd] 之間開始的）
export function occurrenceDates(
  startDate: string,
  freq: RepeatFreq,
  until: string | null,
  windowStart: string,
  windowEnd: string,
): string[] {
  const last = until && until < windowEnd ? until : windowEnd
  if (last < startDate) return []
  const result: string[] = []

  if (freq === 'daily' || freq === 'weekly') {
    const step = freq === 'daily' ? 1 : 7
    // 直接跳到視窗附近，不用從很久以前一天一天算
    const skip = Math.max(0, Math.ceil(diffDays(startDate, windowStart) / step))
    for (let k = skip; ; k++) {
      const d = addDaysISO(startDate, k * step)
      if (d > last) break
      if (d >= windowStart) result.push(d)
    }
    return result
  }

  // 每月：同一天；那個月沒有這一天（例如 31 號）就跳過
  const start = parseISODate(startDate)
  const day = start.getDate()
  const winStart = parseISODate(windowStart)
  const skipMonths = Math.max(
    0,
    (winStart.getFullYear() - start.getFullYear()) * 12 + (winStart.getMonth() - start.getMonth()) - 1,
  )
  for (let k = skipMonths; ; k++) {
    const candidate = new Date(start.getFullYear(), start.getMonth() + k, day)
    if (candidate.getDate() !== day) {
      // 這個月沒有這一天
      const firstOfMonth = toISODate(new Date(start.getFullYear(), start.getMonth() + k, 1))
      if (firstOfMonth > last) break
      continue
    }
    const d = toISODate(candidate)
    if (d > last) break
    if (d >= windowStart) result.push(d)
  }
  return result
}

const timeKey = (t: string | null) => (t ? t.slice(0, 5) : null)

// 把整串設定＋單次覆寫，合成畫面上的一次
export function buildOccurrence(series: Item, originalDate: string, ov: Override | undefined): Occurrence | null {
  if (ov?.is_cancelled) return null
  const duration = diffDays(series.start_date, series.end_date)
  const start = ov?.start_date ?? originalDate
  return {
    ...series,
    key: `${series.id}:${originalDate}`,
    occurrence_date: originalDate,
    series,
    title: ov?.title ?? series.title,
    start_date: start,
    end_date: ov?.end_date ?? addDaysISO(start, duration),
    start_time: ov?.start_time ?? series.start_time,
    end_time: ov?.end_time ?? series.end_time,
    note: ov?.note ?? series.note,
    location: ov?.location ?? series.location,
    is_done: ov?.is_done ?? false,
  }
}

// 主要功能：[from, to] 這段日期裡，畫面上要顯示的每一次
export function expandItems(items: Item[], overrides: Override[], from: string, to: string): Occurrence[] {
  const ovMap = new Map<string, Override>()
  for (const ov of overrides) ovMap.set(`${ov.item_id}:${ov.occurrence_date}`, ov)

  const result: Occurrence[] = []
  for (const item of items) {
    if (!item.repeat_freq) {
      if (item.start_date <= to && item.end_date >= from) {
        result.push({ ...item, key: item.id, occurrence_date: null, series: null })
      }
      continue
    }
    const duration = diffDays(item.start_date, item.end_date)
    // 視窗前後多抓 31 天：單次被移到別天的，也找得到
    const dates = occurrenceDates(
      item.start_date,
      item.repeat_freq,
      item.repeat_until,
      addDaysISO(from, -duration - 31),
      addDaysISO(to, 31),
    )
    for (const d of dates) {
      const occ = buildOccurrence(item, d, ovMap.get(`${item.id}:${d}`))
      if (occ && occ.start_date <= to && occ.end_date >= from) result.push(occ)
    }
  }

  return result.sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      (a.start_time ?? '').localeCompare(b.start_time ?? '') ||
      a.title.localeCompare(b.title),
  )
}

// 「只改這一次」：和整串不同的欄位才存進覆寫；相同的留空白（之後改整串時會跟著變）
export type OverridePatch = Pick<
  Override,
  'title' | 'start_date' | 'end_date' | 'start_time' | 'end_time' | 'note' | 'location'
> & { is_done?: boolean }

export function buildOverridePatch(series: Item, originalDate: string, input: ItemInput): OverridePatch {
  const duration = diffDays(series.start_date, series.end_date)
  const expectedEnd = addDaysISO(input.start_date, duration)
  const same = (a: string | null | undefined, b: string | null | undefined) => (a || null) === (b || null)
  const patch: OverridePatch = {
    title: same(input.title, series.title) ? null : input.title,
    start_date: input.start_date === originalDate ? null : input.start_date,
    end_date: input.end_date === expectedEnd ? null : input.end_date,
    start_time: same(timeKey(input.start_time), timeKey(series.start_time)) ? null : input.start_time,
    end_time: same(timeKey(input.end_time), timeKey(series.end_time)) ? null : input.end_time,
    note: same(input.note, series.note) ? null : input.note,
    location: same(input.location, series.location) ? null : input.location,
  }
  if (input.is_done !== undefined) patch.is_done = input.is_done
  return patch
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 「每週四，到 2027/1/15」
export function describeRepeat(startDate: string, freq: RepeatFreq | null, until: string | null): string {
  if (!freq) return '不重複'
  const d = parseISODate(startDate)
  const base =
    freq === 'daily' ? '每天' : freq === 'weekly' ? `每週${WEEKDAYS[d.getDay()]}` : `每月 ${d.getDate()} 號`
  if (!until) return base
  const u = parseISODate(until)
  return `${base}，到 ${u.getFullYear()}/${u.getMonth() + 1}/${u.getDate()}`
}
