import { describe, expect, it } from 'vitest'
import type { Occurrence } from '../data/types'
import { availabilityRange, bestDays, dayAvailability, hoursText, slotsText } from './freeTime'

function occ(key: string, patch: Partial<Occurrence>): Occurrence {
  return {
    id: key, key, title: key, start_date: '2026-11-10', end_date: '2026-11-10', start_time: null, end_time: null,
    is_done: false, category_id: null, note: null, location: null, repeat_freq: null, repeat_until: null,
    occurrence_date: null, series: null, owner_id: 'me', calendar: 'personal', ...patch,
  }
}

const day = (occs: Occurrence[]) => dayAvailability(occs, '2026-11-10')

describe('可約的判斷：12:00–22:00 空的時間加起來 ≥ 5 小時', () => {
  it('沒有任何安排：10 小時，可約', () => {
    const d = day([])
    expect(slotsText(d)).toBe('12:00–22:00')
    expect(d.totalMinutes).toBe(600)
    expect(d.available).toBe(true)
  })

  it('中午以前、十點以後的行程不影響', () => {
    expect(day([occ('早課', { start_time: '08:00:00', end_time: '12:00:00' }), occ('宵夜', { start_time: '22:00:00', end_time: '23:30:00' })]).totalMinutes).toBe(600)
  })

  it('她上班到 18:00：只剩 4 小時，不算可約', () => {
    const d = day([occ('上班', { owner_id: 'her', start_time: '09:00:00', end_time: '18:00:00' })])
    expect(slotsText(d)).toBe('18:00–22:00')
    expect(d.available).toBe(false)
  })

  it('剛好 5 小時（含）：可約', () => {
    expect(day([occ('上班', { start_time: '09:00:00', end_time: '17:00:00' })]).available).toBe(true)
  })

  it('空檔不用連續，加起來就算：12–15 ＋ 18–20 = 5 小時', () => {
    const d = day([
      occ('a', { start_time: '15:00:00', end_time: '18:00:00' }),
      occ('b', { start_time: '20:00:00', end_time: '23:00:00' }),
    ])
    expect(slotsText(d)).toBe('12:00–15:00、18:00–20:00')
    expect(d.available).toBe(true)
  })

  it('已經排好的約會也算忙', () => {
    const d = day([occ('約會', { calendar: 'shared', start_time: '13:00:00', end_time: '19:00:00' })])
    expect(d.totalMinutes).toBe(240)
    expect(d.available).toBe(false)
  })

  it('單日的整天項目（待辦）不算忙；跨好幾天的整天項目（回家）整天都算忙', () => {
    expect(day([occ('繳費', {})]).available).toBe(true)
    expect(day([occ('回家', { start_date: '2026-11-09', end_date: '2026-11-11' })]).totalMinutes).toBe(0)
  })

  it('沒寫結束時間：當作 1 小時', () => {
    expect(day([occ('a', { start_time: '14:00:00' })]).totalMinutes).toBe(540)
  })

  it('跨午夜：前一晚到凌晨的行程不影響隔天 12:00 以後', () => {
    expect(day([occ('夜', { start_date: '2026-11-09', end_date: '2026-11-10', start_time: '22:00:00', end_time: '02:00:00' })]).totalMinutes).toBe(600)
  })
})

describe('接下來一週可約', () => {
  it('只挑可約的日子、空最多的前 3 天，再依日期排', () => {
    const work = (d: string, end: string) => occ(`w${d}`, { start_date: d, end_date: d, start_time: '09:00:00', end_time: end })
    const days = availabilityRange(
      [
        work('2026-11-09', '18:00:00'), // 4 小時：不可約
        work('2026-11-10', '16:00:00'), // 6 小時
        work('2026-11-11', '13:00:00'), // 9 小時
        work('2026-11-12', '15:00:00'), // 7 小時
        work('2026-11-13', '17:00:00'), // 5 小時
      ],
      '2026-11-09',
      '2026-11-13',
    )
    expect(bestDays(days).map((d) => d.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
  })

  it('時數的寫法', () => {
    expect(hoursText(300)).toBe('5 小時')
    expect(hoursText(330)).toBe('5.5 小時')
  })
})
