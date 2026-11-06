import { describe, expect, it } from 'vitest'
import type { Occurrence } from '../data/types'
import { canEditItem, forMyLists, visibility } from './views'

const ME = 'me'
const HER = 'her'

function occ(key: string, owner: string, calendar: 'personal' | 'shared'): Occurrence {
  return {
    id: key, key, title: key, start_date: '2026-11-10', end_date: '2026-11-10', start_time: null, end_time: null,
    is_done: false, category_id: null, note: null, location: null, repeat_freq: null, repeat_until: null,
    occurrence_date: null, series: null, owner_id: owner, calendar,
  }
}

const myMeal = occ('吃飯', ME, 'personal')
const herWork = occ('上班', HER, 'personal')
const date = occ('約會', ME, 'shared')

describe('三個行事曆各顯示什麼', () => {
  it('我的：我的完整、她的不顯示、約會完整', () => {
    expect([myMeal, herWork, date].map((o) => visibility(o, 'mine', ME))).toEqual(['full', 'hidden', 'full'])
  })
  it('共用：我的和她的都顯示成忙碌（點／宛）、約會完整', () => {
    expect([myMeal, herWork, date].map((o) => visibility(o, 'shared', ME))).toEqual(['busy', 'busy', 'full'])
  })
  it('她的：她的顯示成忙碌（宛）、我的不顯示、約會完整', () => {
    expect([myMeal, herWork, date].map((o) => visibility(o, 'partner', ME))).toEqual(['hidden', 'busy', 'full'])
  })
  it('從她的角度看也一樣（我變成對方）', () => {
    expect([myMeal, herWork, date].map((o) => visibility(o, 'mine', HER))).toEqual(['hidden', 'full', 'full'])
    expect([myMeal, herWork, date].map((o) => visibility(o, 'partner', HER))).toEqual(['busy', 'hidden', 'full'])
  })
})

describe('待辦（checkbox）', () => {
  const myTask = { ...occ('繳費', ME, 'personal'), is_task: true }
  const herTask = { ...occ('買菜', HER, 'personal'), is_task: true }
  it('只在自己的「我的」看得到；共用和對方的都看不到，也不會變成忙碌', () => {
    expect(['mine', 'shared', 'partner'].map((m) => visibility(myTask, m as never, ME))).toEqual(['full', 'hidden', 'hidden'])
    expect(['mine', 'shared', 'partner'].map((m) => visibility(herTask, m as never, ME))).toEqual(['hidden', 'hidden', 'hidden'])
  })
  it('有寫時間的就不是待辦，照一般行程顯示', () => {
    const timed = { ...myTask, start_time: '10:00:00' }
    expect(visibility(timed, 'shared', ME)).toBe('busy')
  })
})

describe('誰能改', () => {
  it('約會兩人都能改；個人行程只有自己能改', () => {
    expect(canEditItem(date, HER)).toBe(true)
    expect(canEditItem(myMeal, ME)).toBe(true)
    expect(canEditItem(myMeal, HER)).toBe(false)
    expect(canEditItem(herWork, ME)).toBe(false)
  })
  it('舊資料沒有擁有者：當作自己的', () => {
    expect(canEditItem({ calendar: 'personal' }, ME)).toBe(true)
  })
})

describe('每日清單只放我的個人行程＋約會', () => {
  it('對方的個人行程不會出現在我的清單', () => {
    expect(forMyLists([myMeal, herWork, date], ME).map((o) => o.title)).toEqual(['吃飯', '約會'])
    expect(forMyLists([myMeal, herWork, date], HER).map((o) => o.title)).toEqual(['上班', '約會'])
  })
})
