import { describe, expect, it } from 'vitest'
import type { Item, Override } from '../data/types'
import {
  buildOverridePatch,
  describeRepeat,
  expandItems,
  occurrenceDates,
} from './recurrence'

function makeItem(patch: Partial<Item>): Item {
  return {
    id: 'jp',
    title: '日文上課',
    start_date: '2026-11-03', // 週二
    end_date: '2026-11-03',
    start_time: '10:20:00',
    end_time: '12:10:00',
    is_done: false,
    category_id: null,
    note: null,
    location: '台大',
    repeat_freq: 'weekly',
    repeat_until: '2027-01-15',
    ...patch,
  }
}

function makeOverride(patch: Partial<Override>): Override {
  return {
    id: 'ov',
    item_id: 'jp',
    occurrence_date: '2026-11-17',
    is_cancelled: false,
    is_done: false,
    title: null,
    start_date: null,
    end_date: null,
    start_time: null,
    end_time: null,
    note: null,
    location: null,
    ...patch,
  }
}

describe('occurrenceDates：依規則算出日期', () => {
  it('每週：每週二，到 1/15 為止', () => {
    const dates = occurrenceDates('2026-11-03', 'weekly', '2027-01-15', '2026-11-01', '2027-02-28')
    expect(dates[0]).toBe('2026-11-03')
    expect(dates).toContain('2026-12-29')
    expect(dates).toContain('2027-01-12')
    expect(dates.at(-1)).toBe('2027-01-12') // 1/19 超過結束日期
    expect(dates.length).toBe(11)
    for (const d of dates) expect(new Date(d + 'T00:00').getDay()).toBe(2)
  })

  it('每天：只算視窗內的', () => {
    expect(occurrenceDates('2026-01-01', 'daily', null, '2026-11-05', '2026-11-07')).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ])
  })

  it('每月 31 號：沒有 31 號的月份跳過', () => {
    expect(occurrenceDates('2026-01-31', 'monthly', null, '2026-01-01', '2026-07-31')).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
      '2026-07-31',
    ])
  })

  it('每月：從很久以前開始也只算視窗內的', () => {
    expect(occurrenceDates('2020-05-10', 'monthly', null, '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-10',
      '2026-12-10',
    ])
  })

  it('視窗在開始日期之前：沒有', () => {
    expect(occurrenceDates('2026-11-03', 'weekly', null, '2026-10-01', '2026-10-31')).toEqual([])
  })

  it('沒有結束日期：一直重複', () => {
    expect(occurrenceDates('2026-11-03', 'weekly', null, '2030-01-01', '2030-01-14').length).toBe(2)
  })
})

describe('expandItems：畫面上的每一次', () => {
  const series = makeItem({})
  const nov = (ovs: Override[]) => expandItems([series], ovs, '2026-11-01', '2026-11-30')

  it('11 月每週二都有，共 4 次', () => {
    expect(nov([]).map((o) => o.start_date)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'])
  })

  it('每一次都有自己的代號，並記得是哪一串', () => {
    const occ = nov([])[1]
    expect(occ.key).toBe('jp:2026-11-10')
    expect(occ.occurrence_date).toBe('2026-11-10')
    expect(occ.series?.id).toBe('jp')
  })

  it('停課：只有那一週不見', () => {
    const dates = nov([makeOverride({ occurrence_date: '2026-11-17', is_cancelled: true })]).map((o) => o.start_date)
    expect(dates).toEqual(['2026-11-03', '2026-11-10', '2026-11-24'])
  })

  it('只改這一次的時間：其他週不變', () => {
    const occs = nov([makeOverride({ occurrence_date: '2026-11-10', start_time: '13:20:00', end_time: '15:10:00' })])
    expect(occs[1].start_time).toBe('13:20:00')
    expect(occs[0].start_time).toBe('10:20:00')
    expect(occs[2].start_time).toBe('10:20:00')
  })

  it('勾完成 11/17 那一次，11/24 還是未完成', () => {
    const occs = nov([makeOverride({ occurrence_date: '2026-11-17', is_done: true })])
    expect(occs.find((o) => o.start_date === '2026-11-17')?.is_done).toBe(true)
    expect(occs.find((o) => o.start_date === '2026-11-24')?.is_done).toBe(false)
  })

  it('改整串的標題：所有次數一起改，被單獨改過時間的那次保留自己的時間', () => {
    const renamed = { ...series, title: '日文（新教室）' }
    const occs = expandItems(
      [renamed],
      [makeOverride({ occurrence_date: '2026-11-10', start_time: '13:20:00' })],
      '2026-11-01',
      '2026-11-30',
    )
    expect(occs.every((o) => o.title === '日文（新教室）')).toBe(true)
    expect(occs[1].start_time).toBe('13:20:00')
  })

  it('單次移到別天：顯示在新的日期', () => {
    const occs = nov([makeOverride({ occurrence_date: '2026-11-10', start_date: '2026-11-12' })])
    expect(occs.map((o) => o.start_date)).toEqual(['2026-11-03', '2026-11-12', '2026-11-17', '2026-11-24'])
  })

  it('從上個月移進這個月的那次也找得到', () => {
    const occs = expandItems(
      [series],
      [makeOverride({ occurrence_date: '2026-11-24', start_date: '2026-12-01' })],
      '2026-12-01',
      '2026-12-07',
    )
    expect(occs.map((o) => o.occurrence_date)).toEqual(['2026-11-24', '2026-12-01'])
  })

  it('跨天的重複項目（例如每週五到週日）：每次都維持一樣長', () => {
    const weekend = makeItem({ id: 'w', start_date: '2026-11-06', end_date: '2026-11-08', start_time: null, end_time: null })
    const occs = expandItems([weekend], [], '2026-11-09', '2026-11-15')
    expect(occs.map((o) => [o.start_date, o.end_date])).toEqual([['2026-11-13', '2026-11-15']])
  })

  it('一般項目照舊；結果依日期、時間排序', () => {
    const one: Item = { ...makeItem({ id: 'x', title: '看牙醫', start_time: '09:00:00', repeat_freq: null, repeat_until: null }), start_date: '2026-11-10', end_date: '2026-11-10' }
    const occs = expandItems([series, one], [], '2026-11-10', '2026-11-10')
    expect(occs.map((o) => o.title)).toEqual(['看牙醫', '日文上課'])
    expect(occs[0].key).toBe('x')
    expect(occs[0].series).toBeNull()
  })
})

describe('buildOverridePatch：只改這一次時，存哪些欄位', () => {
  const series = makeItem({})
  const input = {
    title: '日文上課',
    start_date: '2026-11-10',
    end_date: '2026-11-10',
    start_time: '10:20',
    end_time: '12:10',
    category_id: null,
    note: null,
    location: '台大',
  }

  it('什麼都沒改：全部空白（沿用整串）', () => {
    expect(buildOverridePatch(series, '2026-11-10', input)).toEqual({
      title: null,
      start_date: null,
      end_date: null,
      start_time: null,
      end_time: null,
      note: null,
      location: null,
    })
  })

  it('只改時間：只存時間', () => {
    const p = buildOverridePatch(series, '2026-11-10', { ...input, start_time: '13:20', end_time: '15:10' })
    expect(p.start_time).toBe('13:20')
    expect(p.end_time).toBe('15:10')
    expect(p.title).toBeNull()
  })

  it('移到別天：存新日期，結束日期跟著移所以不用存', () => {
    const p = buildOverridePatch(series, '2026-11-10', { ...input, start_date: '2026-11-12', end_date: '2026-11-12' })
    expect(p.start_date).toBe('2026-11-12')
    expect(p.end_date).toBeNull()
  })

  it('勾完成：一起存', () => {
    expect(buildOverridePatch(series, '2026-11-10', { ...input, is_done: true }).is_done).toBe(true)
  })
})

describe('describeRepeat：重複規則的文字說明', () => {
  it('各種寫法', () => {
    expect(describeRepeat('2026-11-03', 'weekly', '2027-01-15')).toBe('每週二，到 2027/1/15')
    expect(describeRepeat('2026-11-03', 'daily', null)).toBe('每天')
    expect(describeRepeat('2026-11-03', 'monthly', null)).toBe('每月 3 號')
    expect(describeRepeat('2026-11-03', null, null)).toBe('不重複')
  })
})
