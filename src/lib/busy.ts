// 女友檢視：把項目合併成「忙碌」時段，不顯示內容
// 同一時段有好幾個項目（例如約會時一起讀書）也只顯示一格忙碌。

import type { Occurrence } from '../data/types'
import { addDaysISO } from './recurrence'

export type BusyBlock = {
  allDay: boolean
  start: string // 有時間：YYYY-MM-DDTHH:MM；整天：YYYY-MM-DD
  end: string // 有時間：結束時刻；整天：結束日的隔天（不包含，和行事曆元件的規則一樣）
  items: Occurrence[]
}

const DEFAULT_MINUTES = 60 // 沒寫結束時間的，當作佔 1 小時

const pad = (n: number) => String(n).padStart(2, '0')

export function addMinutes(dateTime: string, minutes: number): string {
  const [d, t] = dateTime.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h, min] = t.split(':').map(Number)
  const x = new Date(y, m - 1, day, h, min + minutes)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

function interval(o: Occurrence): { allDay: boolean; start: string; end: string } {
  if (!o.start_time) {
    return { allDay: true, start: o.start_date, end: addDaysISO(o.end_date, 1) }
  }
  const start = `${o.start_date}T${o.start_time.slice(0, 5)}`
  let end: string
  if (o.end_time) end = `${o.end_date}T${o.end_time.slice(0, 5)}`
  else if (o.end_date !== o.start_date) end = `${addDaysISO(o.end_date, 1)}T00:00`
  else end = addMinutes(start, DEFAULT_MINUTES)
  if (end <= start) end = addMinutes(start, DEFAULT_MINUTES)
  return { allDay: false, start, end }
}

// 重疊或剛好接在一起的時段合併成一格（字串格式固定，可以直接比大小）
function merge(list: { start: string; end: string; item: Occurrence }[], allDay: boolean): BusyBlock[] {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  const blocks: BusyBlock[] = []
  for (const x of sorted) {
    const last = blocks.at(-1)
    if (last && x.start <= last.end) {
      if (x.end > last.end) last.end = x.end
      last.items.push(x.item)
    } else {
      blocks.push({ allDay, start: x.start, end: x.end, items: [x.item] })
    }
  }
  return blocks
}

export function mergeBusy(occs: Occurrence[]): BusyBlock[] {
  const timed: { start: string; end: string; item: Occurrence }[] = []
  const allDay: { start: string; end: string; item: Occurrence }[] = []
  for (const o of occs) {
    const iv = interval(o)
    ;(iv.allDay ? allDay : timed).push({ start: iv.start, end: iv.end, item: o })
  }
  return [...merge(allDay, true), ...merge(timed, false)]
}
