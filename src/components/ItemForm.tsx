import { useState, type FormEvent } from 'react'
import type { Category, Item, ItemInput } from '../data/types'
import { sortAsTree } from '../data/categories'
import { formatTime } from '../lib/dates'
import type { ItemDefaults } from '../lib/calendarEvents'
import Modal from './Modal'

type Props = {
  item: Item | null // null = 新增
  defaults: ItemDefaults // 新增時的預設日期／時間
  categories: Category[]
  onSave: (input: ItemInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export default function ItemForm({ item, defaults, categories, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [startDate, setStartDate] = useState(item?.start_date ?? defaults.startDate)
  const [endDate, setEndDate] = useState(item?.end_date ?? defaults.endDate ?? defaults.startDate)
  const [allDay, setAllDay] = useState(item ? !item.start_time : !defaults.startTime)
  const [startTime, setStartTime] = useState(formatTime(item ? item.start_time : defaults.startTime ?? null))
  const [endTime, setEndTime] = useState(formatTime(item ? item.end_time : defaults.endTime ?? null))
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [location, setLocation] = useState(item?.location ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const tree = sortAsTree(categories)

  function changeStartDate(value: string) {
    // 結束日期不能早於開始日期：跟著往後推
    if (endDate < value || endDate === startDate) setEndDate(value)
    setStartDate(value)
  }

  function validate(): string | null {
    if (!title.trim()) return '請填標題'
    if (!startDate || !endDate) return '請選日期'
    if (endDate < startDate) return '結束日期不能早於開始日期'
    if (!allDay) {
      if (!startTime) return '請填開始時間，或勾選「整天」'
      if (endTime && endDate === startDate && endTime < startTime) return '結束時間不能早於開始時間'
    }
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        start_time: allDay ? null : startTime,
        end_time: allDay || !endTime ? null : endTime,
        category_id: categoryId || null,
        location: location.trim() || null,
        note: note.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setBusy(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={item ? '編輯項目' : '新增項目'} onClose={onClose}>
      <form className="item-form" onSubmit={handleSubmit}>
        <label>
          標題 <span className="required">*</span>
          <input
            autoFocus
            value={title}
            maxLength={200}
            placeholder="例如：日文上課、看牙醫"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="row-2">
          <label>
            開始日期
            <input type="date" value={startDate} onChange={(e) => changeStartDate(e.target.value)} />
          </label>
          <label>
            結束日期
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          整天／沒有特定時間（當天待辦）
        </label>

        {!allDay && (
          <div className="row-2">
            <label>
              開始時間
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label>
              結束時間（選填）
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
        )}

        <label>
          類別
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">未分類</option>
            {tree.map(({ top, children }) => [
              <option key={top.id} value={top.id}>
                {top.name}
              </option>,
              ...children.map((c) => (
                <option key={c.id} value={c.id}>
                  {'　└ '}
                  {c.name}
                </option>
              )),
            ])}
          </select>
        </label>

        <label>
          地點（選填）
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>

        <label>
          備註（選填）
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          {item && onDelete && !confirmingDelete && (
            <button
              type="button"
              className="btn-ghost danger-text push-left"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              刪除
            </button>
          )}
          {confirmingDelete && (
            <span className="push-left confirm-inline">
              確定刪除？
              <button type="button" className="btn-danger btn-small" onClick={handleDelete} disabled={busy}>
                刪除
              </button>
              <button type="button" className="btn-ghost btn-small" onClick={() => setConfirmingDelete(false)}>
                不要
              </button>
            </span>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
