import { useEffect, useState } from 'react'
import type { Category, Occurrence } from '../data/types'
import { categoryLabel, resolveColor } from '../data/categories'
import { listOccurrences } from '../data/occurrences'
import { formatDateLabel, formatTime } from '../lib/dates'
import { splitDaily } from '../lib/daily'
import Modal from './Modal'

type Props = {
  date: string
  categories: Category[]
  canEdit: boolean
  onClose: () => void
  onOpen: (occ: Occurrence) => void
  onAdd: (date: string) => void
}

// 手機上點月曆的某一天：從下方滑出這天的清單，可以直接新增（參考 TimeTree）
export default function DaySheet({ date, categories, canEdit, onClose, onOpen, onAdd }: Props) {
  const [items, setItems] = useState<Occurrence[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listOccurrences(date, date)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [date])

  const sections = items ? splitDaily(items, date) : null
  const ordered = sections ? [...sections.allDay, ...sections.timed] : []

  return (
    <Modal title={formatDateLabel(date)} onClose={onClose}>
      {canEdit && (
        <button className="btn-primary sheet-add" onClick={() => onAdd(date)}>
          ＋ 在這天新增
        </button>
      )}
      {error && <p className="error">發生錯誤：{error}</p>}
      {!items && !error && <p className="muted">載入中…</p>}
      {items && ordered.length === 0 && <p className="muted sheet-empty">這天沒有項目。</p>}
      <ul className="sheet-list">
        {ordered.map((occ) => {
          const color = resolveColor(occ.category_id, categories)
          const timed = occ.start_time && occ.start_date === date
          return (
            <li key={occ.key}>
              <button className={occ.is_done ? 'sheet-row done' : 'sheet-row'} onClick={() => canEdit && onOpen(occ)} disabled={!canEdit}>
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
                    {categoryLabel(occ.category_id, categories)}
                    {occ.series && ' · 🔁'}
                    {occ.location && ` · ${occ.location}`}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
