// 每日清單的排列規則
import type { Item } from '../data/types'

export type DailySections<T extends Item> = {
  allDay: T[] // 整天／待辦，以及從前幾天延續過來的跨天項目
  timed: T[] // 這天開始、有時間的項目，依開始時間排
}

export function splitDaily<T extends Item>(items: T[], date: string): DailySections<T> {
  const onThisDay = items.filter((i) => i.start_date <= date && i.end_date >= date)
  const timed = onThisDay
    .filter((i) => i.start_time && i.start_date === date)
    .sort(
      (a, b) =>
        a.start_time!.localeCompare(b.start_time!) ||
        (a.end_time ?? '').localeCompare(b.end_time ?? '') ||
        a.title.localeCompare(b.title),
    )
  const timedSet = new Set<T>(timed)
  const allDay = onThisDay.filter((i) => !timedSet.has(i))
  return { allDay, timed }
}

// 這天完成了幾筆（給「3／5 完成」用）
export function progress(items: Item[]) {
  return { done: items.filter((i) => i.is_done).length, total: items.length }
}
