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
