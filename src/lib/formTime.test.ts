import { describe, expect, it } from 'vitest'
import { chipDate, fromMinutes, shiftEnd, toMinutes } from './formTime'
import { minuteOptions } from '../components/WheelPicker'

describe('新增頁的時間', () => {
  it('分鐘換算', () => {
    expect(toMinutes('10:20')).toBe(620)
    expect(fromMinutes(620)).toBe('10:20')
    expect(fromMinutes(24 * 60 + 30)).toBe('23:55')
  })

  it('改開始時間：結束時間維持原本的長度', () => {
    expect(shiftEnd('10:20', '13:20', '12:10', true)).toBe('15:10')
  })

  it('原本沒有結束時間：預設 1 小時', () => {
    expect(shiftEnd('', '18:30', '', true)).toBe('19:30')
  })

  it('跨天的項目不自動移動結束時間；太晚就停在 23:55', () => {
    expect(shiftEnd('22:00', '23:00', '01:30', false)).toBe('01:30')
    expect(shiftEnd('21:00', '23:30', '23:00', true)).toBe('23:55')
  })

  it('精簡的日期：今年不寫年份', () => {
    const y = new Date().getFullYear()
    expect(chipDate(`${y}-11-10`)).toMatch(/^11\/10（.）$/)
    expect(chipDate(`${y + 1}-01-05`)).toMatch(new RegExp(`^${y + 1}/1/5（.）$`))
  })
})

describe('分鐘滾輪的選項', () => {
  it('每 5 分鐘一格，共 12 格', () => {
    expect(minuteOptions('20').map((o) => o.value)).toHaveLength(12)
  })
  it('不在格子上的分鐘（例如 23）也保留，不會被偷偷改掉', () => {
    const values = minuteOptions('23').map((o) => o.value)
    expect(values).toContain('23')
    expect(values.indexOf('23')).toBe(values.indexOf('20') + 1)
  })
})
