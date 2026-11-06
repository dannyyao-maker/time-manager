import { describe, expect, it } from 'vitest'
import type { Occurrence } from '../data/types'
import { freeSlots, longestFreeByDay } from './freeTime'

function occ(key: string, patch: Partial<Occurrence>): Occurrence {
  return {
    id: key, key, title: key, start_date: '2026-11-10', end_date: '2026-11-10', start_time: null, end_time: null,
    is_done: false, category_id: null, note: null, location: null, repeat_freq: null, repeat_until: null,
    occurrence_date: null, series: null, owner_id: 'me', calendar: 'personal', ...patch,
  }
}

const slots = (occs: Occurrence[], min = 60) =>
  freeSlots(occs, '2026-11-10', '2026-11-10', min).map((s) => `${s.start}-${s.end}`)

describe('共同空檔', () => {
  it('沒有任何安排：09:00–23:00 整段都有空', () => {
    expect(slots([])).toEqual(['09:00-23:00'])
  })

  it('我上課、她上班：剩下兩個人都沒事的時段', () => {
    expect(
      slots([
        occ('日文', { start_time: '10:20:00', end_time: '12:10:00' }),
        occ('上班', { owner_id: 'her', start_time: '09:00:00', end_time: '18:00:00' }),
      ]),
    ).toEqual(['18:00-23:00'])
  })

  it('已經排好的約會也算忙', () => {
    expect(
      slots([occ('約會', { calendar: 'shared', start_time: '19:00:00', end_time: '21:00:00' })]),
    ).toEqual(['09:00-19:00', '21:00-23:00'])
  })

  it('太短的空檔（不到 1 小時）不算', () => {
    expect(
      slots([
        occ('a', { start_time: '09:00:00', end_time: '12:00:00' }),
        occ('b', { start_time: '12:30:00', end_time: '23:00:00' }),
      ]),
    ).toEqual([])
  })

  it('沒寫結束時間：當作 1 小時', () => {
    expect(slots([occ('a', { start_time: '20:00:00' })])).toEqual(['09:00-20:00', '21:00-23:00'])
  })

  it('單日的整天項目（待辦）不算忙；跨好幾天的整天項目（回家）整天都算忙', () => {
    expect(slots([occ('繳費', {})])).toEqual(['09:00-23:00'])
    expect(slots([occ('回家', { start_date: '2026-11-09', end_date: '2026-11-11' })])).toEqual([])
  })

  it('跨午夜的行程：前一晚到凌晨，不影響隔天白天', () => {
    expect(
      freeSlots([occ('夜', { start_date: '2026-11-09', end_date: '2026-11-10', start_time: '22:00:00', end_time: '02:00:00' })], '2026-11-10', '2026-11-10').map((s) => `${s.start}-${s.end}`),
    ).toEqual(['09:00-23:00'])
  })

  it('跨午夜的行程：開始那天的晚上算忙', () => {
    expect(
      freeSlots([occ('夜', { start_date: '2026-11-10', end_date: '2026-11-11', start_time: '21:00:00', end_time: '02:00:00' })], '2026-11-10', '2026-11-10').map((s) => `${s.start}-${s.end}`),
    ).toEqual(['09:00-21:00'])
  })

  it('一次算好幾天；月曆用每天最長的空檔', () => {
    const all = freeSlots(
      [occ('上班', { start_time: '09:00:00', end_time: '22:00:00', start_date: '2026-11-11', end_date: '2026-11-11' })],
      '2026-11-10',
      '2026-11-11',
    )
    const longest = longestFreeByDay(all)
    expect(longest.get('2026-11-10')).toBe(14 * 60)
    expect(longest.get('2026-11-11')).toBe(60)
  })
})
