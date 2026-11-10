import { describe, expect, it } from 'vitest'
import { eventRank, itemToEvent } from './calendarEvents'
import { dayAvailability } from './freeTime'
import type { Occurrence } from '../data/types'

function occ(title: string, extra: Partial<Occurrence> = {}): Occurrence {
  return {
    id: title, key: title, title, start_date: '2026-11-10', end_date: '2026-11-10', start_time: null, end_time: null,
    is_done: false, category_id: null, note: null, location: null, repeat_freq: null, repeat_until: null,
    occurrence_date: null, series: null, calendar: 'personal', ...extra,
  }
}

describe('同一天的順序：紀念日 → 行程 → 待辦', () => {
  it('排序值', () => {
    expect(eventRank(occ('在一起 100 天', { is_special: true, calendar: 'shared' }))).toBe(0)
    expect(eventRank(occ('日文', { start_time: '10:20:00' }))).toBe(1)
    expect(eventRank(occ('出遊'))).toBe(1)
    expect(eventRank(occ('改履歷', { is_task: true }))).toBe(2)
  })

  it('行事曆事件帶著排序值，月曆就會把待辦排在行程下面', () => {
    const list = [occ('改履歷', { is_task: true }), occ('da例會', { start_time: '22:00:00' }), occ('日文', { start_time: '10:20:00' })]
    const sorted = list.map((o) => itemToEvent(o, [])).sort((a, b) => a.extendedProps.rank - b.extendedProps.rank)
    expect(sorted.at(-1)!.title).toBe('☐ 改履歷')
  })

  it('紀念日不影響可約', () => {
    const day = dayAvailability([occ('在一起 100 天', { is_special: true, calendar: 'shared' })], '2026-11-10')
    expect(day.available).toBe(true)
  })
})
