// 把某個行事曆（我的／共用／對方的）要顯示的項目，轉成行事曆元件的事件
import type { EventInput } from '@fullcalendar/core'
import type { Category, Occurrence } from '../data/types'
import { memberBadge, type Member } from '../data/members'
import { itemToEvent } from './calendarEvents'
import { mergeBusy } from './busy'
import { shade, tint } from './color'
import { canEditItem, isMine, visibility, type ViewMode } from './views'

export function ownerKey(o: Occurrence, me: string | null): string {
  return isMine(o, me) ? me ?? 'me' : o.owner_id ?? 'unknown'
}

export function buildViewEvents(
  occs: Occurrence[],
  mode: ViewMode,
  me: string | null,
  members: Member[],
  categories: Category[],
): EventInput[] {
  const events: EventInput[] = []
  const busyByOwner = new Map<string, Occurrence[]>()

  for (const o of occs) {
    const v = visibility(o, mode, me)
    if (v === 'full') {
      events.push({ ...itemToEvent(o, categories), editable: canEditItem(o, me) })
    } else if (v === 'busy') {
      const k = ownerKey(o, me)
      busyByOwner.set(k, [...(busyByOwner.get(k) ?? []), o])
    }
  }

  // 忙碌：同一個人重疊的時段合成一格，標上「點」或「宛」
  for (const [owner, list] of busyByOwner) {
    const badge = memberBadge(members.find((m) => m.user_id === owner))
    mergeBusy(list).forEach((block, i) => {
      events.push({
        id: `busy-${owner}-${i}`,
        title: block.allDay ? `${badge.label}（整天）` : badge.label,
        start: block.start,
        end: block.end,
        allDay: block.allDay,
        backgroundColor: tint(badge.color, 0.2),
        borderColor: badge.color,
        textColor: shade(badge.color, 0.3),
        classNames: ['is-busy'],
        editable: false,
        extendedProps: { block, owner },
      })
    })
  }
  return events
}

// 對方是誰（成員名冊裡除了我以外、可以編輯的那一位）
export function findPartner(members: Member[], me: string | null): Member | undefined {
  return members.find((m) => m.user_id !== me && m.role !== 'viewer')
}
