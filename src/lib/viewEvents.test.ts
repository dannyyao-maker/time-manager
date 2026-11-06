import { describe, expect, it } from 'vitest'
import type { Occurrence } from '../data/types'
import type { Member } from '../data/members'
import { OWNER_COLOR, EDITOR_COLOR, SHARED_COLOR } from '../data/categories'
import { buildViewEvents, findPartner } from './viewEvents'

const ME = 'me'
const HER = 'her'
const members: Member[] = [
  { user_id: ME, display_name: '點', role: 'owner' },
  { user_id: HER, display_name: '宛', role: 'editor' },
]

function occ(key: string, owner: string, calendar: 'personal' | 'shared', st: string, et: string): Occurrence {
  return {
    id: key, key, title: key, start_date: '2026-11-10', end_date: '2026-11-10', start_time: st, end_time: et,
    is_done: false, category_id: null, note: null, location: null, repeat_freq: null, repeat_until: null,
    occurrence_date: null, series: null, owner_id: owner, calendar,
  }
}

const data = [
  occ('日文', ME, 'personal', '10:20:00', '12:10:00'),
  occ('吃飯', ME, 'personal', '12:00:00', '13:00:00'),
  occ('上班', HER, 'personal', '09:00:00', '18:00:00'),
  occ('約會', ME, 'shared', '19:00:00', '21:00:00'),
]

const titles = (mode: 'mine' | 'shared' | 'partner') =>
  buildViewEvents(data, mode, ME, members, []).map((e) => e.title).sort()

describe('三個行事曆實際顯示的內容', () => {
  it('我的：我的兩筆完整＋約會；看不到她的', () => {
    expect(titles('mine')).toEqual(['吃飯', '日文', '約會'])
  })

  it('共用：我的兩筆重疊合成一格「點」、她的是「宛」、約會完整', () => {
    expect(titles('shared')).toEqual(['宛', '約會', '點'])
    const dot = buildViewEvents(data, 'shared', ME, members, []).find((e) => e.title === '點')!
    expect([dot.start, dot.end]).toEqual(['2026-11-10T10:20', '2026-11-10T13:00'])
    expect(dot.borderColor).toBe(OWNER_COLOR)
    expect(dot.editable).toBe(false)
  })

  it('她的：只有「宛」＋約會', () => {
    const ev = buildViewEvents(data, 'partner', ME, members, [])
    expect(ev.map((e) => e.title).sort()).toEqual(['宛', '約會'])
    expect(ev.find((e) => e.title === '宛')!.borderColor).toBe(EDITOR_COLOR)
  })

  it('約會用紫色、可以拖拉', () => {
    const date = buildViewEvents(data, 'partner', ME, members, []).find((e) => e.title === '約會')!
    expect(date.borderColor).toBe(SHARED_COLOR)
    expect(date.editable).toBe(true)
  })

  it('從她的角度：共用裡我是「點」、她自己的是「宛」', () => {
    expect(buildViewEvents(data, 'shared', HER, members, []).map((e) => e.title).sort()).toEqual(['宛', '約會', '點'])
  })
})

describe('findPartner：對方是誰', () => {
  it('我是點，對方是宛；反過來也是', () => {
    expect(findPartner(members, ME)?.display_name).toBe('宛')
    expect(findPartner(members, HER)?.display_name).toBe('點')
  })
  it('還沒加女友：沒有對方', () => {
    expect(findPartner([members[0]], ME)).toBeUndefined()
  })
})
