import { describe, expect, it } from 'vitest'
import type { Item } from '../data/types'
import { progress, splitDaily } from './daily'

function makeItem(id: string, patch: Partial<Item>): Item {
  return {
    id,
    title: id,
    start_date: '2026-11-06',
    end_date: '2026-11-06',
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

describe('splitDaily：每日清單怎麼排', () => {
  const items = [
    makeItem('晚餐', { start_time: '18:30:00' }),
    makeItem('買牛奶', {}),
    makeItem('日文', { start_time: '10:20:00', end_time: '12:10:00' }),
    makeItem('出遊', { start_date: '2026-11-05', end_date: '2026-11-08' }),
    makeItem('過夜活動', { start_date: '2026-11-05', end_date: '2026-11-06', start_time: '20:00:00' }),
    makeItem('明天的事', { start_date: '2026-11-07', end_date: '2026-11-07' }),
    makeItem('昨天的事', { start_date: '2026-11-05', end_date: '2026-11-05', start_time: '09:00:00' }),
  ]
  const { allDay, timed } = splitDaily(items, '2026-11-06')

  it('有時間的依開始時間排', () => {
    expect(timed.map((i) => i.title)).toEqual(['日文', '晚餐'])
  })

  it('整天／待辦，以及前幾天延續過來的跨天項目，放在上面', () => {
    expect(allDay.map((i) => i.title)).toEqual(['買牛奶', '出遊', '過夜活動'])
  })

  it('不是這天的不會出現', () => {
    const all = [...allDay, ...timed].map((i) => i.title)
    expect(all).not.toContain('明天的事')
    expect(all).not.toContain('昨天的事')
  })

  it('跨天項目在最後一天也會出現', () => {
    const last = splitDaily(items, '2026-11-08')
    expect(last.allDay.map((i) => i.title)).toEqual(['出遊'])
  })
})

describe('progress：完成幾筆', () => {
  it('算出完成數和總數', () => {
    expect(progress([makeItem('a', { is_done: true }), makeItem('b', {}), makeItem('c', { is_done: true })])).toEqual({
      done: 2,
      total: 3,
    })
  })
})
