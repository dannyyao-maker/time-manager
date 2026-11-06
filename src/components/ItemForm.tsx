import { useState, type FormEvent } from 'react'
import type { CalendarKind, Category, Item, ItemInput, RepeatFreq } from '../data/types'
import { SHARED_COLOR, UNCATEGORIZED_COLOR, topLevel } from '../data/categories'
import { formatShortDate, formatTime } from '../lib/dates'
import { addDaysISO, describeRepeat, diffDays } from '../lib/recurrence'
import { chipDate, shiftEnd } from '../lib/formTime'
import { getCurrentUserId } from '../lib/session'
import { isMine } from '../lib/views'
import type { ItemDefaults } from '../lib/calendarEvents'
import Modal from './Modal'
import MiniMonth from './MiniMonth'
import TimeWheel from './WheelPicker'

// item：一般項目或新增；series：編輯整串重複；occurrence：只改重複項目的這一次
export type FormMode = 'item' | 'series' | 'occurrence'

type Props = {
  item: Item | null // null = 新增
  mode?: FormMode
  defaults: ItemDefaults & { calendar?: CalendarKind } // 新增時的預設日期／時間／行事曆
  categories: Category[]
  onSave: (input: ItemInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

type Panel = 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'until' | null

const REPEAT_OPTIONS: { value: RepeatFreq | ''; label: string }[] = [
  { value: '', label: '不重複' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
]

// 新增／編輯頁（參考 TimeTree）：大標題、選「忙碌／一起」、日期和時間用小月曆與滾輪
export default function ItemForm({ item, mode = 'item', defaults, categories, onSave, onDelete, onClose }: Props) {
  const me = getCurrentUserId()
  const [title, setTitle] = useState(item?.title ?? '')
  const [calendar, setCalendar] = useState<CalendarKind>(item?.calendar ?? defaults.calendar ?? 'personal')
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
  const [panel, setPanel] = useState<Panel>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isOccurrence = mode === 'occurrence'
  const showRepeat = !isOccurrence
  const showDone = !!item && mode !== 'series' && !repeatFreq
  // 「忙碌／一起」只有新增、或自己建立的項目可以切換（改整串時也可以）；單獨一次不行
  const canSwitchCalendar = !isOccurrence && (!item || isMine(item, me))
  const isShared = calendar === 'shared'

  // 類別：只列自己的；如果這筆還掛在舊的類別上，也列出來，免得存檔時被清掉
  const options = topLevel(categories).filter((c) => !c.owner_id || c.owner_id === me)
  const current = categories.find((c) => c.id === item?.category_id)
  if (current && !options.includes(current)) options.push(current)

  const heading = !item
    ? '新增'
    : mode === 'series'
      ? '編輯整串重複'
      : isOccurrence
        ? `只改這一次（${formatShortDate(item.start_date)}）`
        : '編輯'
  const deleteLabel = mode === 'series' ? '刪除整串' : isOccurrence ? '刪除這一次' : '刪除'
  const deleteQuestion = mode === 'series' ? '整串都刪掉？' : isOccurrence ? '只刪這一次（例如停課）？' : '確定刪除？'

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p))

  function changeStartDate(value: string) {
    // 結束日期跟著移動（維持天數）
    setEndDate(addDaysISO(value, Math.max(0, diffDays(startDate, endDate))))
    setStartDate(value)
  }

  function changeStartTime(value: string) {
    setEndTime(shiftEnd(startTime, value, endTime, startDate === endDate))
    setStartTime(value)
  }

  function changeAllDay(next: boolean) {
    setAllDay(next)
    setPanel(null)
    if (!next && !startTime) {
      setStartTime('09:00')
      setEndTime('10:00')
    }
  }

  function validate(): string | null {
    if (!title.trim()) return '請填標題'
    if (!startDate || !endDate) return '請選日期'
    if (endDate < startDate) return '結束日期不能早於開始日期'
    if (!allDay) {
      if (!startTime) return '請選開始時間，或打開「全天」'
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
      category_id: isShared ? null : categoryId || null,
      location: location.trim() || null,
      note: note.trim() || null,
    }
    if (showDone || isOccurrence) input.is_done = done
    if (showRepeat) {
      input.repeat_freq = repeatFreq || null
      input.repeat_until = repeatFreq && repeatUntil ? repeatUntil : null
    }
    if (canSwitchCalendar) input.calendar = calendar
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
    <Modal title={heading} onClose={onClose} bare className="tt-sheet">
      <form className="tt-form" onSubmit={handleSubmit}>
        <div className="tt-head">
          <button type="button" className="tt-close" onClick={onClose} aria-label="關閉" disabled={busy}>
            ✕
          </button>
          <span className="tt-heading">{heading}</span>
          <button type="submit" className="btn-primary tt-save" disabled={busy}>
            {busy ? '儲存中…' : '保存'}
          </button>
        </div>

        {isOccurrence && <p className="form-note">只會改這一次，其他次不受影響。</p>}
        {mode === 'series' && (
          <p className="form-note">會改到這一串的每一次。被單獨改過的那幾次，會保留它們自己改過的欄位。</p>
        )}

        <input
          className="tt-title"
          autoFocus={!item}
          value={title}
          maxLength={200}
          placeholder="標題"
          aria-label="標題"
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* 行事曆：忙碌（只有自己的行程，對方看到是點／宛）或一起（約會，兩人都能改） */}
        <div className="tt-row">
          <span className="tt-label">行事曆</span>
          {canSwitchCalendar ? (
            <div className="seg" role="radiogroup" aria-label="行事曆">
              <button
                type="button"
                role="radio"
                aria-checked={!isShared}
                className={!isShared ? 'seg-btn active' : 'seg-btn'}
                onClick={() => setCalendar('personal')}
              >
                忙碌（只有我）
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={isShared}
                className={isShared ? 'seg-btn active shared' : 'seg-btn'}
                onClick={() => setCalendar('shared')}
              >
                一起（約會）
              </button>
            </div>
          ) : (
            <span className="tt-value">{isShared ? '一起（約會）' : '忙碌（只有我）'}</span>
          )}
        </div>

        <div className="tt-row">
          <span className="tt-label">全天</span>
          <label className="switch">
            <input type="checkbox" checked={allDay} onChange={(e) => changeAllDay(e.target.checked)} disabled={isOccurrence} />
          </label>
        </div>

        <div className="tt-row tt-when">
          <span className="tt-label">開始</span>
          <span className="tt-chips">
            <button type="button" className={panel === 'startDate' ? 'chip active' : 'chip'} onClick={() => toggle('startDate')}>
              {chipDate(startDate)}
            </button>
            {!allDay && (
              <button type="button" className={panel === 'startTime' ? 'chip active' : 'chip'} onClick={() => toggle('startTime')}>
                {startTime || '時間'}
              </button>
            )}
          </span>
        </div>
        {panel === 'startDate' && (
          <MiniMonth
            value={startDate}
            onChange={(d) => {
              changeStartDate(d)
              setPanel(null)
            }}
          />
        )}
        {panel === 'startTime' && <TimeWheel value={startTime} onChange={changeStartTime} />}

        <div className="tt-row tt-when">
          <span className="tt-label">結束</span>
          <span className="tt-chips">
            <button type="button" className={panel === 'endDate' ? 'chip active' : 'chip'} onClick={() => toggle('endDate')}>
              {chipDate(endDate)}
            </button>
            {!allDay && (
              <button type="button" className={panel === 'endTime' ? 'chip active' : 'chip'} onClick={() => toggle('endTime')}>
                {endTime || '不設定'}
              </button>
            )}
          </span>
        </div>
        {panel === 'endDate' && (
          <MiniMonth
            value={endDate}
            min={startDate}
            onChange={(d) => {
              setEndDate(d)
              setPanel(null)
            }}
          />
        )}
        {panel === 'endTime' && (
          <>
            <TimeWheel value={endTime || startTime} onChange={setEndTime} />
            {endTime && (
              <button type="button" className="btn-ghost btn-small tt-clear" onClick={() => setEndTime('')}>
                不設定結束時間
              </button>
            )}
          </>
        )}

        {showRepeat && (
          <>
            <div className="tt-row tt-wrap">
              <span className="tt-label">重複</span>
              <div className="seg seg-small" role="radiogroup" aria-label="重複">
                {REPEAT_OPTIONS.map((o) => (
                  <button
                    type="button"
                    key={o.value}
                    role="radio"
                    aria-checked={repeatFreq === o.value}
                    className={repeatFreq === o.value ? 'seg-btn active' : 'seg-btn'}
                    onClick={() => setRepeatFreq(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {repeatFreq && (
              <div className="tt-row tt-when">
                <span className="tt-label">重複到</span>
                <span className="tt-chips">
                  <button type="button" className={panel === 'until' ? 'chip active' : 'chip'} onClick={() => toggle('until')}>
                    {repeatUntil ? chipDate(repeatUntil) : '一直重複'}
                  </button>
                  {repeatUntil && (
                    <button type="button" className="btn-ghost btn-small" onClick={() => setRepeatUntil('')}>
                      清除
                    </button>
                  )}
                </span>
              </div>
            )}
            {repeatFreq && panel !== 'until' && (
              <p className="muted small tt-hint">{describeRepeat(startDate, repeatFreq, repeatUntil || null)}</p>
            )}
            {panel === 'until' && (
              <MiniMonth
                value={repeatUntil || startDate}
                min={startDate}
                onChange={(d) => {
                  setRepeatUntil(d)
                  setPanel(null)
                }}
              />
            )}
          </>
        )}

        {/* 標籤（類別）：「一起」的項目統一用約會的紫色 */}
        <div className="tt-row tt-wrap">
          <span className="tt-label">標籤</span>
          {isShared ? (
            <span className="tag-chip static" style={{ ['--tag' as string]: SHARED_COLOR }}>
              <span className="dot" style={{ background: SHARED_COLOR }} />
              約會
            </span>
          ) : (
            <div className="tag-list">
              <button
                type="button"
                className={categoryId === '' ? 'tag-chip active' : 'tag-chip'}
                style={{ ['--tag' as string]: UNCATEGORIZED_COLOR }}
                onClick={() => setCategoryId('')}
                disabled={isOccurrence}
              >
                <span className="dot" style={{ background: UNCATEGORIZED_COLOR }} />
                未分類
              </button>
              {options.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={categoryId === c.id ? 'tag-chip active' : 'tag-chip'}
                  style={{ ['--tag' as string]: c.color ?? UNCATEGORIZED_COLOR }}
                  onClick={() => setCategoryId(c.id)}
                  disabled={isOccurrence}
                >
                  <span className="dot" style={{ background: c.color ?? UNCATEGORIZED_COLOR }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {isOccurrence && !isShared && <p className="muted small tt-hint">標籤要改整串。</p>}

        <div className="tt-row">
          <span className="tt-label">地點</span>
          <input className="tt-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="選填" />
        </div>

        <div className="tt-row tt-top">
          <span className="tt-label">備註</span>
          <textarea className="tt-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="選填" />
        </div>

        {(showDone || isOccurrence) && (
          <div className="tt-row">
            <span className="tt-label">{isOccurrence ? '這一次完成' : '已完成'}</span>
            <label className="switch">
              <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
            </label>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {item && onDelete && (
          <div className="tt-delete">
            {!confirmingDelete ? (
              <button type="button" className="btn-ghost danger-text" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                {deleteLabel}
              </button>
            ) : (
              <span className="confirm-inline">
                {deleteQuestion}
                <button type="button" className="btn-danger btn-small" onClick={handleDelete} disabled={busy}>
                  {deleteLabel}
                </button>
                <button type="button" className="btn-ghost btn-small" onClick={() => setConfirmingDelete(false)}>
                  不要
                </button>
              </span>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
