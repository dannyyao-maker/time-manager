import { describe, expect, it } from 'vitest'
import type { Category, Item } from '../data/types'
import { addDays, eventToTiming, itemToEvent, itemToInput, selectionToDefaults } from './calendarEvents'
import { resolveColor, UNCATEGORIZED_COLOR } from '../data/categories'

const cats: Category[] = [
  { id: 'top', parent_id: null, name: '研所課程', color: '#3B82F6', sort_order: 0 },
  { id: 'child', parent_id: 'top', name: '日文', color: null, sort_order: 0 },
  { id: 'child2', parent_id: 'top', name: 'R', color: '#10B981', sort_order: 1 },
]

function makeItem(patch: Partial<Item>): Item {
  return {
    id: 'i1',
    title: '測試',
    start_date: '2026-11-05',
    end_date: '2026-11-05',
    start_time: null,
    end_time: null,
    is_done: false,
    category_id: null,
    note: null,
    location: null,
    repeat_freq: null,
    repeat_until: null,
    ...patch,
  }
}

// 用本地時間建立 Date（和瀏覽器上行事曆給的一樣）
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

describe('addDays：日期加減', () => {
  it('跨月、跨年、閏年都正確', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-11-05', 0)).toBe('2026-11-05')
  })
})

describe('itemToEvent：項目 → 行事曆事件', () => {
  it('整天、單日：結束是隔天（行事曆的規則）', () => {
    const e = itemToEvent(makeItem({}), cats)
    expect(e).toMatchObject({ allDay: true, start: '2026-11-05', end: '2026-11-06' })
  })

  it('整天、跨三天：畫成一條橫跨 11/5–11/7 的長條', () => {
    const e = itemToEvent(makeItem({ end_date: '2026-11-07' }), cats)
    expect(e).toMatchObject({ allDay: true, start: '2026-11-05', end: '2026-11-08' })
  })

  it('有開始和結束時間', () => {
    const e = itemToEvent(makeItem({ start_time: '10:20:00', end_time: '12:10:00' }), cats)
    expect(e).toMatchObject({ allDay: false, start: '2026-11-05T10:20', end: '2026-11-05T12:10' })
  })

  it('只有開始時間：不給結束', () => {
    const e = itemToEvent(makeItem({ start_time: '09:00:00' }), cats)
    expect(e.allDay).toBe(false)
    expect(e.start).toBe('2026-11-05T09:00')
    expect(e.end).toBeUndefined()
  })

  it('跨天、有開始時間但沒結束時間：畫到結束日隔天 0 點', () => {
    const e = itemToEvent(makeItem({ start_time: '20:00:00', end_date: '2026-11-06' }), cats)
    expect(e).toMatchObject({ start: '2026-11-05T20:00', end: '2026-11-07T00:00' })
  })

  it('地點會接在標題後面', () => {
    expect(itemToEvent(makeItem({ location: '台大' }), cats).title).toBe('測試｜台大')
  })

  it('顏色：第二層沒設定就沿用第一層；自己有就用自己的；未分類是灰色', () => {
    expect(itemToEvent(makeItem({ category_id: 'child' }), cats).backgroundColor).toBe('#3B82F6')
    expect(itemToEvent(makeItem({ category_id: 'child2' }), cats).backgroundColor).toBe('#10B981')
    expect(itemToEvent(makeItem({ category_id: null }), cats).backgroundColor).toBe(UNCATEGORIZED_COLOR)
    expect(resolveColor('不存在的類別', cats)).toBe(UNCATEGORIZED_COLOR)
  })
})

describe('eventToTiming：拖拉之後 → 存回資料庫的欄位', () => {
  it('整天、拖成 11/5–11/7（行事曆給的結束是 11/8）', () => {
    expect(eventToTiming(local(2026, 11, 5), local(2026, 11, 8), true)).toEqual({
      start_date: '2026-11-05',
      end_date: '2026-11-07',
      start_time: null,
      end_time: null,
    })
  })

  it('整天、沒有結束：單日', () => {
    expect(eventToTiming(local(2026, 11, 5), null, true)).toMatchObject({
      start_date: '2026-11-05',
      end_date: '2026-11-05',
    })
  })

  it('有時間：10:20–12:10', () => {
    expect(eventToTiming(local(2026, 11, 5, 10, 20), local(2026, 11, 5, 12, 10), false)).toEqual({
      start_date: '2026-11-05',
      end_date: '2026-11-05',
      start_time: '10:20',
      end_time: '12:10',
    })
  })

  it('有時間、沒有結束時間：保持沒有結束時間', () => {
    expect(eventToTiming(local(2026, 11, 5, 9, 5), null, false)).toEqual({
      start_date: '2026-11-05',
      end_date: '2026-11-05',
      start_time: '09:05',
      end_time: null,
    })
  })

  it('有時間、跨到隔天凌晨', () => {
    expect(eventToTiming(local(2026, 11, 5, 22, 0), local(2026, 11, 6, 1, 30), false)).toMatchObject({
      start_date: '2026-11-05',
      end_date: '2026-11-06',
      end_time: '01:30',
    })
  })
})

describe('來回轉換不會跑掉', () => {
  const cases: Partial<Item>[] = [
    {},
    { end_date: '2026-11-07' },
    { start_date: '2026-12-30', end_date: '2027-01-02' },
    { start_time: '10:20:00', end_time: '12:10:00' },
    { start_time: '22:00:00', end_time: '01:30:00', end_date: '2026-11-06' },
  ]
  for (const patch of cases) {
    it(JSON.stringify(patch), () => {
      const item = makeItem(patch)
      const e = itemToEvent(item, cats)
      const parse = (s: string) => {
        const [d, t] = s.split('T')
        const [y, m, day] = d.split('-').map(Number)
        const [h, min] = (t ?? '00:00').split(':').map(Number)
        return local(y, m, day, h, min)
      }
      const back = eventToTiming(parse(e.start), e.end ? parse(e.end) : null, e.allDay)
      expect(back.start_date).toBe(item.start_date)
      expect(back.end_date).toBe(item.end_date)
      expect(back.start_time).toBe(item.start_time ? item.start_time.slice(0, 5) : null)
      expect(back.end_time).toBe(item.end_time ? item.end_time.slice(0, 5) : null)
    })
  }
})

describe('selectionToDefaults：點空白格 → 新增表單的預設值', () => {
  it('月曆點一天', () => {
    expect(selectionToDefaults(local(2026, 11, 5), local(2026, 11, 6), true)).toEqual({
      startDate: '2026-11-05',
      endDate: '2026-11-05',
      startTime: null,
      endTime: null,
    })
  })

  it('週曆點 14:00 那一格', () => {
    expect(selectionToDefaults(local(2026, 11, 5, 14), local(2026, 11, 5, 14, 30), false)).toEqual({
      startDate: '2026-11-05',
      endDate: '2026-11-05',
      startTime: '14:00',
      endTime: '14:30',
    })
  })
})

describe('itemToInput', () => {
  it('只留表單欄位', () => {
    const input = itemToInput(makeItem({ title: 'A', note: 'n' }))
    expect(Object.keys(input).sort()).toEqual(
      ['category_id', 'end_date', 'end_time', 'location', 'note', 'start_date', 'start_time', 'title'].sort(),
    )
  })
})
