import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category, Item } from '../data/types'
import { categoryLabel, listCategories, resolveColor } from '../data/categories'
import { createItem, deleteItem, listItems, updateItem } from '../data/items'
import { formatDateLabel, formatShortDate, formatTime, todayISO } from '../lib/dates'
import ItemForm from '../components/ItemForm'

type Props = { canEdit: boolean }

// 暫時的列表檢視：階段 3 會加上月曆和週曆
export default function ItemsPage({ canEdit }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState<Item | 'new' | null>(null)

  const today = todayISO()

  const reload = useCallback(async () => {
    try {
      const [its, cats] = await Promise.all([listItems(showPast ? undefined : today), listCategories()])
      setItems(its)
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
    const map = new Map<string, Item[]>()
    for (const item of items) {
      const key = !showPast && item.start_date < today ? today : item.start_date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items, showPast, today])

  function timeText(item: Item) {
    if (!item.start_time) return '整天'
    return item.end_time
      ? `${formatTime(item.start_time)}–${formatTime(item.end_time)}`
      : formatTime(item.start_time)
  }

  return (
    <section>
      <div className="page-title">
        <h1>項目</h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => setEditing('new')}>
            ＋ 新增項目
          </button>
        )}
      </div>

      <label className="checkbox toggle-past">
        <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
        顯示過去的項目
      </label>

      {error && <p className="error">發生錯誤：{error}</p>}
      {loading && <p className="muted">載入中…</p>}

      {!loading && groups.length === 0 && (
        <div className="empty-box">
          <p>{showPast ? '還沒有任何項目。' : '今天以後沒有項目。'}</p>
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
            const color = resolveColor(item.category_id, categories)
            const multiDay = item.end_date !== item.start_date
            return (
              <button
                key={item.id}
                className={item.is_done ? 'item-row done' : 'item-row'}
                style={{ borderLeftColor: color }}
                onClick={() => canEdit && setEditing(item)}
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
                    {categoryLabel(item.category_id, categories)}
                    {multiDay && ` · ${formatShortDate(item.start_date)}–${formatShortDate(item.end_date)}`}
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
        <ItemForm
          item={editing === 'new' ? null : editing}
          defaults={{ startDate: today }}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (editing === 'new') await createItem(input)
            else await updateItem(editing.id, input)
            setEditing(null)
            await reload()
          }}
          onDelete={
            editing === 'new'
              ? undefined
              : async () => {
                  await deleteItem(editing.id)
                  setEditing(null)
                  await reload()
                }
          }
        />
      )}
    </section>
  )
}
