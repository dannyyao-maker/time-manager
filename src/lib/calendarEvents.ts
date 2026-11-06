// 項目 ⇄ 行事曆事件 的轉換
// 行事曆元件（FullCalendar）的規則：整天事件的 end 是「結束日的隔天」（不包含）

import type { Category, Item, ItemInput } from '../data/types'
import { resolveColor } from '../data/categories'
import { parseISODate, toISODate } from './dates'
import { shade, tint } from './color'

export type CalendarEvent = {
  id: string
  title: string
  start: string
  end?: string
  allDay: boolean
  backgroundColor: string
  borderColor: string
  textColor: string
  classNames: string[]
  extendedProps: { item: Item }
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

const hhmm = (t: string) => t.slice(0, 5)

// item 可以是一般項目，或重複項目算出來的其中一次（有 key）
export function itemToEvent(item: Item & { key?: string }, categories: Category[]): CalendarEvent {
  const color = resolveColor(item.category_id, categories)
  const base = {
    id: item.key ?? item.id,
    title: item.location ? `${item.title}｜${item.location}` : item.title,
    // 標籤樣式：淡底色、同色系深一點的字；borderColor 給週曆左邊的色條用
    backgroundColor: tint(color, 0.18),
    borderColor: color,
    textColor: shade(color, 0.28),
    classNames: item.is_done ? ['is-done'] : [],
    extendedProps: { item },
  }

  if (!item.start_time) {
    return { ...base, allDay: true, start: item.start_date, end: addDays(item.end_date, 1) }
  }

  const start = `${item.start_date}T${hhmm(item.start_time)}`
  if (item.end_time) {
    return { ...base, allDay: false, start, end: `${item.end_date}T${hhmm(item.end_time)}` }
  }
  // 跨天但沒有結束時間：畫到結束日的隔天 0 點
  if (item.end_date !== item.start_date) {
    return { ...base, allDay: false, start, end: `${addDays(item.end_date, 1)}T00:00` }
  }
  return { ...base, allDay: false, start }
}

const pad = (n: number) => String(n).padStart(2, '0')
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

// 拖拉之後：行事曆給的新開始／結束 → 要存回資料庫的欄位
export function eventToTiming(
  start: Date,
  end: Date | null,
  allDay: boolean,
): Pick<ItemInput, 'start_date' | 'end_date' | 'start_time' | 'end_time'> {
  const startDate = toISODate(start)
  if (allDay) {
    const endDate = end ? addDays(toISODate(end), -1) : startDate
    return {
      start_date: startDate,
      end_date: endDate < startDate ? startDate : endDate,
      start_time: null,
      end_time: null,
    }
  }
  if (!end) {
    return { start_date: startDate, end_date: startDate, start_time: timeOf(start), end_time: null }
  }
  return {
    start_date: startDate,
    end_date: toISODate(end),
    start_time: timeOf(start),
    end_time: timeOf(end),
  }
}

// 在行事曆上點一格或拖一段空白 → 新增表單的預設值
export function selectionToDefaults(start: Date, end: Date, allDay: boolean): ItemDefaults {
  const t = eventToTiming(start, end, allDay)
  return {
    startDate: t.start_date,
    endDate: t.end_date,
    startTime: t.start_time,
    endTime: t.end_time,
  }
}

export type ItemDefaults = {
  startDate: string
  endDate?: string
  startTime?: string | null
  endTime?: string | null
}

export function itemToInput(item: Item): ItemInput {
  return {
    title: item.title,
    start_date: item.start_date,
    end_date: item.end_date,
    start_time: item.start_time,
    end_time: item.end_time,
    category_id: item.category_id,
    note: item.note,
    location: item.location,
    is_done: item.is_done,
  }
}
