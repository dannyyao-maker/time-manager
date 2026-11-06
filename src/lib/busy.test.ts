import { describe, expect, it } from 'vitest'
import type { Occurrence } from '../data/types'
import { addMinutes, mergeBusy } from './busy'

function occ(key: string, patch: Partial<Occurrence>): Occurrence {
  return {
    id: key,
    key,
    title: key,
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
    occurrence_date: null,
    series: null,
    ...patch,
  }
}

const summary = (b: ReturnType<typeof mergeBusy>) => b.map((x) => [x.allDay, x.start, x.end, x.items.map((i) => i.key)])

describe('mergeBusy：合併成忙碌時段', () => {
  it('時間重疊的兩筆（約會＋論文）合併成一格', () => {
    const b = mergeBusy([
      occ('約會', { start_time: '14:00:00', end_time: '18:00:00' }),
      occ('論文', { start_time: '15:00:00', end_time: '17:00:00' }),
    ])
    expect(summary(b)).toEqual([[false, '2026-11-06T14:00', '2026-11-06T18:00', ['約會', '論文']]])
  })

  it('剛好接在一起的也合併；中間有空檔的分開', () => {
    const b = mergeBusy([
      occ('a', { start_time: '10:00:00', end_time: '12:00:00' }),
      occ('b', { start_time: '12:00:00', end_time: '13:00:00' }),
      occ('c', { start_time: '15:00:00', end_time: '16:00:00' }),
    ])
    expect(summary(b)).toEqual([
      [false, '2026-11-06T10:00', '2026-11-06T13:00', ['a', 'b']],
      [false, '2026-11-06T15:00', '2026-11-06T16:00', ['c']],
    ])
  })

  it('沒有結束時間：當作 1 小時', () => {
    expect(summary(mergeBusy([occ('x', { start_time: '23:30:00' })]))).toEqual([
      [false, '2026-11-06T23:30', '2026-11-07T00:30', ['x']],
    ])
  })

  it('整天的和有時間的分開算；整天的連續幾天合成一條', () => {
    const b = mergeBusy([
      occ('回家', { start_date: '2026-11-06', end_date: '2026-11-08' }),
      occ('繳費', { start_date: '2026-11-08', end_date: '2026-11-08' }),
      occ('上課', { start_time: '10:00:00', end_time: '11:00:00' }),
    ])
    expect(summary(b)).toEqual([
      [true, '2026-11-06', '2026-11-09', ['回家', '繳費']],
      [false, '2026-11-06T10:00', '2026-11-06T11:00', ['上課']],
    ])
  })

  it('跨午夜的時段', () => {
    expect(
      summary(mergeBusy([occ('夜', { start_time: '22:00:00', end_time: '01:30:00', end_date: '2026-11-07' })])),
    ).toEqual([[false, '2026-11-06T22:00', '2026-11-07T01:30', ['夜']]])
  })

  it('沒有項目：沒有忙碌時段', () => {
    expect(mergeBusy([])).toEqual([])
  })

  it('addMinutes 跨日、跨月', () => {
    expect(addMinutes('2026-11-30T23:30', 60)).toBe('2026-12-01T00:30')
  })
})
