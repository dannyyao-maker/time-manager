// 三個行事曆的顯示規則（第二版）
//   我的：我的個人行程（完整）＋約會（完整）
//   共用：我的個人行程顯示成「點」、對方的顯示成「宛」＋約會（完整）
//   對方的：對方的個人行程完整顯示（只能看，不能改）＋約會（完整）（2026-11-07 改）
// 資料只有一份，三個行事曆只是不同的看法。

import type { Occurrence } from '../data/types'

export type ViewMode = 'mine' | 'shared' | 'partner'

export type Visibility = 'full' | 'busy' | 'hidden'

export function isShared(o: { calendar?: string }): boolean {
  return o.calendar === 'shared'
}

export function isMine(o: { owner_id?: string }, me: string | null): boolean {
  // 舊資料或第一版沒有 owner_id 時，當作是我的
  return !o.owner_id || o.owner_id === me
}

// 待辦（checkbox、沒有時間）：不算行程
export function isTask(o: { is_task?: boolean; start_time: string | null }): boolean {
  return !!o.is_task && !o.start_time
}

export function visibility(o: Occurrence, mode: ViewMode, me: string | null): Visibility {
  // 待辦只在自己的「我的」行事曆看得到；不會變成忙碌
  if (isTask(o)) return mode === 'mine' && isMine(o, me) ? 'full' : 'hidden'
  if (isShared(o)) return 'full'
  const mine = isMine(o, me)
  if (mode === 'mine') return mine ? 'full' : 'hidden'
  if (mode === 'partner') return mine ? 'hidden' : 'full'
  return 'busy' // 共用：兩個人的個人行程都顯示成忙碌
}

// 能不能改：約會兩人都能改；個人行程只有自己能改
export function canEditItem(o: { calendar?: string; owner_id?: string }, me: string | null): boolean {
  return isShared(o) || isMine(o, me)
}

// 每日清單、項目列表：我的個人行程＋約會
export function forMyLists<T extends { calendar?: string; owner_id?: string }>(items: T[], me: string | null): T[] {
  return items.filter((o) => isShared(o) || isMine(o, me))
}
