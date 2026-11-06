import { useState, type FormEvent } from 'react'
import type { Category, Item, ItemInput, RepeatFreq } from '../data/types'
import { topLevel } from '../data/categories'
import { formatShortDate, formatTime } from '../lib/dates'
import { describeRepeat } from '../lib/recurrence'
import type { ItemDefaults } from '../lib/calendarEvents'
import Modal from './Modal'

// item：一般項目或新增；series：編輯整串重複；occurrence：只改重複項目的這一次
export type FormMode = 'item' | 'series' | 'occurrence'

type Props = {
  item: Item | null // null = 新增
  mode?: FormMode
  defaults: ItemDefaults // 新增時的預設日期／時間
  categories: Category[]
  onSave: (input: ItemInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const REPEAT_OPTIONS: { value: RepeatFreq | ''; label: string }[] = [
  { value: '', label: '不重複' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
]

export default function ItemForm({ item, mode = 'item', defaults, categories, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [startDate, setStartDate] = useState(item?.start_date ?? defaults.startDate)
  const [endDate, setEndDate] = useState(item?.end_date ?? defaults.endDate ?? defaults.startDate)
  const [allDay, setAllDay] = useState(item ? !item.start_time : !defaults.startTime)
  const [startTime, setStartTime] = useState(formatTime(item ? item.start_time : defaults.startTime ?? null))
  const [endTime, setEndTime] = useState(formatTime(item ? item.end_time : defaults.endTime ?? null))
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [location, setLocation] = useState(item?.location ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [done, setDone] = useState(item?.is_done ?? false)
  const [repeatFreq, setRepeatFreq] = useState<RepeatFreq | ''>(item?.repeat_freq ?? '')
  const [repeatUntil, setRepeatUntil] = useState(item?.repeat_until ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // 只列第一層；如果這筆還掛在舊的第二層類別上，也列出來，免得存檔時被清掉
  const options = topLevel(categories)
  const current = categories.find((c) => c.id === item?.category_id)
  if (current && !options.includes(current)) options.push(current)
  const isOccurrence = mode === 'occurrence'
  const showRepeat = !isOccurrence
  const showDone = !!item && mode !== 'series' && !repeatFreq

  const heading = !item
    ? '新增項目'
    : mode === 'series'
      ? '編輯整串重複'
      : isOccurrence
        ? `只改這一次（${formatShortDate(item.start_date)}）`
        : '編輯項目'
  const deleteLabel = mode === 'series' ? '刪除整串' : isOccurrence ? '刪除這一次' : '刪除'
  const deleteQuestion =
    mode === 'series' ? '整串都刪掉？' : isOccurrence ? '只刪這一次（例如停課）？' : '確定刪除？'

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
    if (repeatFreq && repeatUntil && repeatUntil < startDate) return '「重複到」不能早於開始日期'
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
    const input: ItemInput = {
      title: title.trim(),
      start_date: startDate,
      end_date: endDate,
      start_time: allDay ? null : startTime,
      end_time: allDay || !endTime ? null : endTime,
      category_id: categoryId || null,
      location: location.trim() || null,
      note: note.trim() || null,
    }
    if (showDone || isOccurrence) input.is_done = done
    if (showRepeat) {
      input.repeat_freq = repeatFreq || null
      input.repeat_until = repeatFreq && repeatUntil ? repeatUntil : null
    }
    try {
      await onSave(input)
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
    <Modal title={heading} onClose={onClose}>
      <form className="item-form" onSubmit={handleSubmit}>
        {isOccurrence && (
          <p className="form-note">只會改這一次，其他次不受影響。</p>
        )}
        {mode === 'series' && (
          <p className="form-note">會改到這一串的每一次。被單獨改過的那幾次，會保留它們自己改過的欄位。</p>
        )}

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
            {mode === 'series' ? '第一次的日期' : '開始日期'}
            <input type="date" value={startDate} onChange={(e) => changeStartDate(e.target.value)} />
          </label>
          <label>
            結束日期
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            disabled={isOccurrence}
          />
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

        {showRepeat && (
          <div className="repeat-box">
            <div className="row-2">
              <label>
                重複
                <select value={repeatFreq} onChange={(e) => setRepeatFreq(e.target.value as RepeatFreq | '')}>
                  {REPEAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {repeatFreq && (
                <label>
                  重複到（選填）
                  <input
                    type="date"
                    value={repeatUntil}
                    min={startDate}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                  />
                </label>
              )}
            </div>
            {repeatFreq && (
              <p className="muted small repeat-desc">
                {describeRepeat(startDate, repeatFreq, repeatUntil || null)}
                {!repeatUntil && '（沒有結束日期）'}
              </p>
            )}
          </div>
        )}

        {item?.calendar === 'shared' ? (
          <p className="muted small">共用項目不分類（統一用共用色）。</p>
        ) : (
          <label>
            類別
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isOccurrence}>
              <option value="">未分類</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {isOccurrence && <span className="muted small">類別要改整串</span>}
          </label>
        )}

        <label>
          地點（選填）
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>

        <label>
          備註（選填）
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {(showDone || isOccurrence) && (
          <label className="checkbox">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
            {isOccurrence ? '這一次已完成' : '已完成'}
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          {item && onDelete && !confirmingDelete && (
            <button
              type="button"
              className="btn-ghost danger-text push-left"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              {deleteLabel}
            </button>
          )}
          {confirmingDelete && (
            <span className="push-left confirm-inline">
              {deleteQuestion}
              <button type="button" className="btn-danger btn-small" onClick={handleDelete} disabled={busy}>
                {deleteLabel}
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
