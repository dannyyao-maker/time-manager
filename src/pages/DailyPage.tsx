import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Category, Occurrence } from '../data/types'
import { categoryLabel, listCategories, resolveColor } from '../data/categories'
import { createItem } from '../data/items'
import { listOccurrences, setOccurrenceDone } from '../data/occurrences'
import { addDays } from '../lib/calendarEvents'
import { formatDateLabel, formatShortDate, formatTime, todayISO } from '../lib/dates'
import { progress, splitDaily } from '../lib/daily'
import OccurrenceEditor, { type EditTarget } from '../components/OccurrenceEditor'

type Props = { canEdit: boolean }

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// 每日清單：像原本的 Notion 表，但不限筆數；和行事曆是同一份資料
export default function DailyPage({ canEdit }: Props) {
  const [date, setDate] = useState(todayISO)
  const [items, setItems] = useState<Occurrence[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const today = todayISO()

  const reload = useCallback(async () => {
    try {
      const [its, cats] = await Promise.all([listOccurrences(date, date), listCategories()])
      setItems(its)
      setCategories(cats)
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  // 勾選：畫面先變（感覺比較快），存失敗再改回來
  // 重複項目只勾「這一次」
  async function toggleDone(item: Occurrence) {
    const next = !item.is_done
    setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, is_done: next } : i)))
    try {
      await setOccurrenceDone(item, next)
    } catch (e) {
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, is_done: item.is_done } : i)))
      setError(errMsg(e))
    }
  }

  // 快速新增：打標題按 Enter，就是這天的一筆待辦
  async function quickAdd(e: FormEvent) {
    e.preventDefault()
    const title = quickTitle.trim()
    if (!title) return
    setAdding(true)
    try {
      await createItem({
        title,
        start_date: date,
        end_date: date,
        start_time: null,
        end_time: null,
        category_id: null,
        note: null,
        location: null,
      })
      setQuickTitle('')
      await reload()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setAdding(false)
    }
  }

  const { allDay, timed } = splitDaily(items, date)
  const { done, total } = progress([...allDay, ...timed])

  function renderRow(item: Occurrence) {
    const color = resolveColor(item.category_id, categories)
    const multiDay = item.end_date !== item.start_date
    let time = '整天'
    if (item.start_time && item.start_date === date) {
      time = item.end_time
        ? `${formatTime(item.start_time)}–${formatTime(item.end_time)}`
        : formatTime(item.start_time)
    } else if (item.start_date < date) {
      time = '接續'
    }
    return (
      <li key={item.key} className={item.is_done ? 'daily-row done' : 'daily-row'} style={{ borderLeftColor: color }}>
        <input
          type="checkbox"
          className="daily-check"
          checked={item.is_done}
          onChange={() => toggleDone(item)}
          disabled={!canEdit}
          aria-label={`${item.title} 完成`}
        />
        <span className="daily-time">{time}</span>
        <button
          className="daily-main"
          onClick={() => canEdit && setEditing({ kind: 'occ', occ: item })}
          disabled={!canEdit}
        >
          <span className="item-title">{item.title}</span>
          <span className="item-meta">
            <span className="dot" style={{ background: color }} />
            {categoryLabel(item.category_id, categories)}
            {multiDay && ` · ${formatShortDate(item.start_date)}–${formatShortDate(item.end_date)}`}
            {item.series && ' · 🔁 重複'}
            {item.location && ` · 📍${item.location}`}
          </span>
          {item.note && <span className="item-note">{item.note}</span>}
        </button>
      </li>
    )
  }

  return (
    <section>
      <div className="page-title">
        <h1>每日清單</h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => setEditing({ kind: 'new', defaults: { startDate: date } })}>
            ＋ 新增項目
          </button>
        )}
      </div>

      <div className="day-nav">
        <button className="btn-secondary btn-small" onClick={() => setDate(addDays(date, -1))} aria-label="前一天">
          ‹<span className="nav-text"> 前一天</span>
        </button>
        <div className="day-nav-center">
          <strong>{formatDateLabel(date)}</strong>
          {date === today ? (
            <span className="badge">今天</span>
          ) : (
            <button className="btn-ghost btn-small" onClick={() => setDate(today)}>
              回到今天
            </button>
          )}
          <input
            type="date"
            className="day-picker"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="選日期"
          />
        </div>
        <button className="btn-secondary btn-small" onClick={() => setDate(addDays(date, 1))} aria-label="後一天">
          <span className="nav-text">後一天 </span>›
        </button>
      </div>

      {total > 0 && (
        <div className="daily-progress">
          <div className="bar">
            <div className="bar-fill" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="muted small">
            完成 {done}／{total}
          </span>
        </div>
      )}

      {error && <p className="error">發生錯誤：{error}</p>}
      {loading && <p className="muted">載入中…</p>}

      {!loading && (
        <>
          {allDay.length > 0 && (
            <>
              <h3 className="day-label">整天／待辦</h3>
              <ul className="daily-list">{allDay.map(renderRow)}</ul>
            </>
          )}
          {timed.length > 0 && (
            <>
              <h3 className="day-label">有時間的</h3>
              <ul className="daily-list">{timed.map(renderRow)}</ul>
            </>
          )}
          {total === 0 && <p className="muted daily-empty">這天沒有項目。</p>}

          {canEdit && (
            <form className="inline-form quick-add" onSubmit={quickAdd}>
              <input
                placeholder="快速新增待辦：輸入後按 Enter"
                value={quickTitle}
                maxLength={200}
                onChange={(e) => setQuickTitle(e.target.value)}
              />
              <button className="btn-secondary" type="submit" disabled={adding || !quickTitle.trim()}>
                新增
              </button>
            </form>
          )}
        </>
      )}

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
