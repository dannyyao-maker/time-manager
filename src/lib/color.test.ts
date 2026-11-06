import { describe, expect, it } from 'vitest'
import { shade, tint } from './color'
import { itemToEvent } from './calendarEvents'

describe('color：標籤的淡底色和深色字', () => {
  it('tint：0 = 白色、1 = 原色', () => {
    expect(tint('#3D8FE0', 0)).toBe('#ffffff')
    expect(tint('#3D8FE0', 1)).toBe('#3d8fe0')
  })

  it('shade：0 = 原色、1 = 黑色', () => {
    expect(shade('#3D8FE0', 0)).toBe('#3d8fe0')
    expect(shade('#3D8FE0', 1)).toBe('#000000')
  })

  it('行事曆事件：淡底色、深色字、邊框是原色', () => {
    const e = itemToEvent(
      {
        id: 'x', title: 't', start_date: '2026-11-05', end_date: '2026-11-05', start_time: null, end_time: null,
        is_done: false, category_id: 'c', note: null, location: null, repeat_freq: null, repeat_until: null,
      },
      [{ id: 'c', parent_id: null, name: 'c', color: '#E2534B', sort_order: 0 }],
    )
    expect(e.borderColor).toBe('#E2534B')
    expect(e.backgroundColor).toBe(tint('#E2534B', 0.18))
    expect(e.textColor).toBe(shade('#E2534B', 0.28))
  })
})

describe('共用項目的顏色和標籤', async () => {
  const { itemColor, itemLabel, SHARED_COLOR } = await import('../data/categories')
  const cats = [{ id: 'c', parent_id: null, name: '約會', color: '#3D8FE0', sort_order: 0 }]
  it('共用項目用共用色、標籤寫「共用」；個人行程照類別', () => {
    expect(itemColor({ category_id: null, calendar: 'shared' }, cats)).toBe(SHARED_COLOR)
    expect(itemLabel({ category_id: null, calendar: 'shared' }, cats)).toBe('共用')
    expect(itemColor({ category_id: 'c', calendar: 'personal' }, cats)).toBe('#3D8FE0')
    expect(itemLabel({ category_id: 'c' }, cats)).toBe('約會')
  })
})
