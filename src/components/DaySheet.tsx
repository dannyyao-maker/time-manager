import { useEffect, useState } from 'react'
import type { Category, Occurrence } from '../data/types'
import { itemColor, itemLabel } from '../data/categories'
import { listOccurrences } from '../data/occurrences'
import { memberBadge, type Member } from '../data/members'
import { formatDateLabel, formatTime } from '../lib/dates'
import { splitDaily } from '../lib/daily'
import { getCurrentUserId } from '../lib/session'
import { canEditItem, isMine, visibility, type ViewMode } from '../lib/views'
import Modal from './Modal'

type Props = {
  date: string
  mode: ViewMode
  categories: Category[]
  members: Member[]
  canEdit: boolean
  onClose: () => void
  onOpen: (occ: Occurrence) => void // 可以改的：打開編輯
  onView: (occ: Occurrence) => void // 對方的個人行程：只看細節
  onAdd: (date: string) => void
}

// 點月曆的某一天：先看到這天原本的行程，右上角小＋才新增（參考 TimeTree）
export default function DaySheet({ date, mode, categories, members, canEdit, onClose, onOpen, onView, onAdd }: Props) {
  const me = getCurrentUserId()
  const [items, setItems] = useState<Occurrence[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listOccurrences(date, date)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [date])

  const visible = (items ?? []).filter((o) => visibility(o, mode, me) !== 'hidden')
  const sections = splitDaily(visible, date)
  const ordered = [...sections.allDay, ...sections.timed]

  return (
    <Modal title={formatDateLabel(date)} onClose={onClose} bare>
      <div className="sheet-head">
        <h2>{formatDateLabel(date)}</h2>
        <span className="sheet-actions">
          {canEdit && (
            <button className="round-add" onClick={() => onAdd(date)} aria-label="在這天新增">
              ＋
            </button>
          )}
          <button className="btn-icon" onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </span>
      </div>
      {error && <p className="error">發生錯誤：{error}</p>}
      {!items && !error && <p className="muted">載入中…</p>}
      {items && ordered.length === 0 && (
        <p className="muted sheet-empty">這天還沒有行程{canEdit && '，按右上角 ＋ 新增'}。</p>
      )}
      <ul className="sheet-list">
        {ordered.map((occ) => {
          const others = !isMine(occ, me) && occ.calendar !== 'shared'
          const badge = others || (mode === 'shared' && occ.calendar !== 'shared')
            ? memberBadge(members.find((m) => m.user_id === occ.owner_id) ?? (isMine(occ, me) ? members.find((m) => m.user_id === me) : undefined))
            : null
          const color = badge ? badge.color : itemColor(occ, categories)
          const editable = canEdit && canEditItem(occ, me)
          const timed = occ.start_time && occ.start_date === date
          return (
            <li key={occ.key}>
              <button
                className={occ.is_done ? 'sheet-row done' : 'sheet-row'}
                onClick={() => (editable ? onOpen(occ) : onView(occ))}
              >
                <span className="sheet-time">
                  {timed ? (
                    <>
                      <span>{formatTime(occ.start_time)}</span>
                      {occ.end_time && <span className="muted">{formatTime(occ.end_time)}</span>}
                    </>
                  ) : (
                    <span className="muted">整天</span>
                  )}
                </span>
                <span className="sheet-bar" style={{ background: color }} />
                <span className="sheet-main">
                  <span className="item-title">{occ.title}</span>
                  <span className="muted small">
                    {badge ? badge.label : itemLabel(occ, categories)}
                    {occ.series && ' · 🔁'}
                    {occ.location && ` · ${occ.location}`}
                  </span>
                </span>
                {badge && (
                  <span className="person-badge" style={{ background: badge.color }}>
                    {badge.label}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
