import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category, Occurrence } from '../data/types'
import { itemLabel, listCategories, itemColor } from '../data/categories'
import { listOccurrences } from '../data/occurrences'
import { addDays } from '../lib/calendarEvents'
import { formatDateLabel, formatShortDate, formatTime, todayISO } from '../lib/dates'
import OccurrenceEditor, { type EditTarget } from '../components/OccurrenceEditor'
import { forMyLists } from '../lib/views'
import { getCurrentUserId } from '../lib/session'

type Props = { canEdit: boolean }

// 列表檢視：重複項目沒有盡頭，所以只列一段期間
const FUTURE_DAYS = 90
const PAST_DAYS = 365

export default function ItemsPage({ canEdit }: Props) {
  const [items, setItems] = useState<Occurrence[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState<EditTarget | null>(null)

  const today = todayISO()

  const reload = useCallback(async () => {
    try {
      const from = showPast ? addDays(today, -PAST_DAYS) : today
      const [its, cats] = await Promise.all([
        listOccurrences(from, addDays(today, FUTURE_DAYS)),
        listCategories(),
      ])
      setItems(forMyLists(its, getCurrentUserId()))
      setCategories(cats)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [showPast, today])

  useEffect(() => {
    reload()
  }, [reload])

  // 依日期分組；只看未來時，已經開始但還沒結束的跨天項目放在「今天」
  const groups = useMemo(() => {
    const map = new Map<string, Occurrence[]>()
    for (const item of items) {
      const key = !showPast && item.start_date < today ? today : item.start_date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items, showPast, today])

  function timeText(item: Occurrence) {
    if (!item.start_time) return '整天'
    return item.end_time
      ? `${formatTime(item.start_time)}–${formatTime(item.end_time)}`
      : formatTime(item.start_time)
  }

  return (
    <section>
      <div className="page-title">
        <h1>項目列表</h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => setEditing({ kind: 'new', defaults: { startDate: today } })}>
            ＋ 新增項目
          </button>
        )}
      </div>

      <label className="checkbox toggle-past">
        <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
        也顯示過去一年的項目
      </label>
      <p className="muted small list-range">列出到 {FUTURE_DAYS} 天後為止；更遠的請看行事曆。</p>

      {error && <p className="error">發生錯誤：{error}</p>}
      {loading && <p className="muted">載入中…</p>}

      {!loading && groups.length === 0 && (
        <div className="empty-box">
          <p>這段期間沒有項目。</p>
          {canEdit && <p className="muted small">按右上角「＋ 新增項目」開始。</p>}
        </div>
      )}

      {groups.map(([date, dayItems]) => (
        <div className="day-group" key={date}>
          <h3 className={date === today ? 'day-label today' : 'day-label'}>
            {formatDateLabel(date)}
            {date === today && <span className="badge">今天</span>}
          </h3>
          {dayItems.map((item) => {
            const color = itemColor(item, categories)
            const multiDay = item.end_date !== item.start_date
            return (
              <button
                key={item.key}
                className={item.is_done ? 'item-row done' : 'item-row'}
                style={{ borderLeftColor: color }}
                onClick={() => canEdit && setEditing({ kind: 'occ', occ: item })}
                disabled={!canEdit}
              >
                <span className="item-time">{timeText(item)}</span>
                <span className="item-main">
                  <span className="item-title">
                    {item.is_done && '✓ '}
                    {item.title}
                  </span>
                  <span className="item-meta">
                    <span className="dot" style={{ background: color }} />
                    {itemLabel(item, categories)}
                    {multiDay && ` · ${formatShortDate(item.start_date)}–${formatShortDate(item.end_date)}`}
                    {item.series && ' · 🔁 重複'}
                    {item.location && ` · 📍${item.location}`}
                  </span>
                  {item.note && <span className="item-note">{item.note}</span>}
                </span>
              </button>
            )
          })}
        </div>
      ))}

      {editing && (
        <OccurrenceEditor
          target={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onChanged={reload}
        />
      )}
    </section>
  )
}
