import { useCallback, useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import type {
  DateSelectArg,
  DatesSetArg,
  EventChangeArg,
  EventClickArg,
  EventInput,
  EventSourceFuncArg,
} from '@fullcalendar/core'
import type { Category, Occurrence } from '../data/types'
import { listCategories } from '../data/categories'
import { updateItem } from '../data/items'
import { listOccurrences, occurrenceToInput, saveThisOccurrence } from '../data/occurrences'
import { listMembers, memberBadge, type Member } from '../data/members'
import { addDays, eventToTiming, itemToInput, selectionToDefaults } from '../lib/calendarEvents'
import { toISODate, todayISO } from '../lib/dates'
import { getCurrentUserId } from '../lib/session'
import { canEditItem, type ViewMode } from '../lib/views'
import { buildViewEvents, findPartner } from '../lib/viewEvents'
import type { BusyBlock } from '../lib/busy'
import { availabilityRange, bestDays, hoursText, slotsText, type DayAvailability } from '../lib/freeTime'
import { chipDate } from '../lib/formTime'
import { useIsNarrow, useIsTouch } from '../hooks/useMedia'
import OccurrenceEditor, { type EditTarget } from '../components/OccurrenceEditor'
import DaySheet from '../components/DaySheet'
import BusyDetail from '../components/BusyDetail'

type Props = { canEdit: boolean }

const VIEW_KEY = 'tm.calendarView'
const MODE_KEY = 'tm.calendarMode'
const VIEWS = ['dayGridMonth', 'timeGridWeek', 'timeGridDay']
const MODES: ViewMode[] = ['mine', 'shared', 'partner']

// 記住上次看的設定（只存在這台裝置的瀏覽器）
function load<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    if (v && (allowed as string[]).includes(v)) return v as T
  } catch {
    // 無痕模式等情況讀不到，用預設值
  }
  return fallback
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 存不了也沒關係
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

const FREE_KEY = 'tm.showFree'
const WEEK_FREE_MINUTES = 60 // 週曆／日曆：可約的日子裡，至少 1 小時的空檔才標綠色

// 週曆／日曆：可約日子的空檔 → 綠色背景
function freeEvents(days: DayAvailability[]): EventInput[] {
  return days
    .filter((d) => d.available)
    .flatMap((d) => d.slots.filter((s) => s.minutes >= WEEK_FREE_MINUTES))
    .map((s, i) => ({
      id: `free-${i}`,
      start: `${s.date}T${s.start}`,
      end: `${s.date}T${s.end}`,
      display: 'background',
      classNames: ['free-slot'],
    }))
}

// 單筆項目的細節（給對方的個人行程用，只能看）
function singleBlock(occ: Occurrence): BusyBlock {
  const allDay = !occ.start_time
  return {
    allDay,
    start: allDay ? occ.start_date : `${occ.start_date}T${occ.start_time!.slice(0, 5)}`,
    end: allDay ? addDays(occ.end_date, 1) : `${occ.end_date}T${(occ.end_time ?? occ.start_time!).slice(0, 5)}`,
    items: [occ],
  }
}

export default function CalendarPage({ canEdit }: Props) {
  const me = getCurrentUserId()
  const calendarRef = useRef<FullCalendar>(null)
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [view, setView] = useState(() => load(VIEW_KEY, VIEWS, 'dayGridMonth'))
  const [mode, setMode] = useState<ViewMode>(() => load(MODE_KEY, MODES, 'mine'))
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [sheetDate, setSheetDate] = useState<string | null>(null)
  const [detail, setDetail] = useState<BusyBlock | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFree, setShowFree] = useState(() => load(FREE_KEY, ['on', 'off'], 'on') === 'on')
  const [upcoming, setUpcoming] = useState<DayAvailability[] | null>(null)
  const [version, setVersion] = useState(0) // 資料有改動就加一，讓「接下來一週可約」重新算
  const availableDays = useRef(new Set<string>()) // 月曆上要標「可約」的日子
  const isNarrow = useIsNarrow()
  const isTouch = useIsTouch()

  // 行事曆元件讀資料時用的最新值
  const ctx = useRef({ mode, me, members, categories: [] as Category[], showFree })
  ctx.current = { mode, me, members, categories: categories ?? [], showFree }

  const partner = findPartner(members, me)
  const partnerName = partner ? memberBadge(partner).label : null
  const activeMode: ViewMode = mode === 'partner' && !partner ? 'mine' : mode

  useEffect(() => {
    Promise.all([listCategories(), listMembers()])
      .then(([cats, mems]) => {
        setCategories(cats)
        setMembers(mems)
      })
      .catch((e) => setError(errMsg(e)))
  }, [])

  const refetch = () => {
    calendarRef.current?.getApi().refetchEvents()
    setVersion((v) => v + 1)
  }

  // 月曆：在可約的日子加上小小的「可約」標籤（直接加在格子上，不佔項目的位置）
  const markAvailableDays = useCallback(() => {
    const wrap = document.querySelector('.calendar-wrap')
    wrap?.querySelectorAll<HTMLElement>('.fc-daygrid-day[data-date]').forEach((cell) => {
      cell.classList.toggle('is-available', availableDays.current.has(cell.dataset.date!))
    })
  }, [])

  // 共用行事曆最上面：接下來一週可約的日子
  useEffect(() => {
    if (activeMode !== 'shared' || !showFree) {
      setUpcoming(null)
      return
    }
    let cancelled = false
    const today = todayISO()
    const last = addDays(today, 6)
    listOccurrences(today, last)
      .then((occs) => {
        if (!cancelled) setUpcoming(bestDays(availabilityRange(occs, today, last)))
      })
      .catch(() => {
        if (!cancelled) setUpcoming(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeMode, showFree, version])

  // 換行事曆時重新畫
  useEffect(() => {
    refetch()
  }, [activeMode, members, showFree])

  // 行事曆換到哪段日期，就去資料庫拿那段日期的項目
  const fetchEvents = useCallback(
    (info: EventSourceFuncArg, success: (events: EventInput[]) => void, failure: (error: Error) => void) => {
      const from = toISODate(info.start)
      const to = addDays(toISODate(info.end), -1)
      listOccurrences(from, to)
        .then((occs) => {
          setError(null)
          const c = ctx.current
          const m = c.mode === 'partner' && !findPartner(c.members, c.me) ? 'mine' : c.mode
          const events = buildViewEvents(occs, m, c.me, c.members, c.categories)
          // 共用行事曆：標出可約的日子（12:00–22:00 有一段連續 5 小時兩人都沒安排）
          const days = m === 'shared' && c.showFree ? availabilityRange(occs, from, to) : []
          availableDays.current = new Set(days.filter((d) => d.available).map((d) => d.date))
          // 綠色空檔一律放進去（月曆會用 CSS 藏起來、改顯示「可約」標籤）：
          // 從月曆切到週曆時，行事曆元件會沿用月曆已經拿到的資料，不會重拿
          events.push(...freeEvents(days))
          success(events)
          markAvailableDays()
        })
        .catch((e) => {
          setError(errMsg(e))
          failure(e instanceof Error ? e : new Error(String(e)))
        })
    },
    [],
  )

  const newDefaults = (date: string) => ({
    startDate: date,
    calendar: activeMode === 'shared' ? ('shared' as const) : ('personal' as const),
  })

  // 電腦：拖一段時間或好幾天 → 直接新增
  function handleSelect(arg: DateSelectArg) {
    arg.view.calendar.unselect()
    if (!canEdit) return
    setEditing({ kind: 'new', defaults: { ...selectionToDefaults(arg.start, arg.end, arg.allDay), calendar: newDefaults('').calendar } })
  }

  // 點一下某天 → 先看這天的清單（電腦、手機都一樣）
  function handleDateClick(arg: DateClickArg) {
    setSheetDate(toISODate(arg.date))
  }

  function handleEventClick(arg: EventClickArg) {
    const block = arg.event.extendedProps.block as BusyBlock | undefined
    if (block) {
      setDetail(block)
      return
    }
    const occ = arg.event.extendedProps.item as Occurrence
    if (canEdit && canEditItem(occ, me)) setEditing({ kind: 'occ', occ })
    else setDetail(singleBlock(occ))
  }

  // 拖拉移動或拉長：直接存回資料庫；失敗就還原。重複項目拖拉時只移動這一次
  async function handleEventChange(arg: EventChangeArg) {
    const occ = arg.event.extendedProps.item as Occurrence | undefined
    if (!occ) {
      arg.revert()
      return
    }
    const timing = eventToTiming(arg.event.start!, arg.event.end, arg.event.allDay)
    try {
      if (occ.series) await saveThisOccurrence(occ, { ...occurrenceToInput(occ), ...timing })
      else await updateItem(occ.id, { ...itemToInput(occ), ...timing })
      refetch()
    } catch (e) {
      arg.revert()
      setError(errMsg(e))
    }
  }

  function handleDatesSet(arg: DatesSetArg) {
    if (arg.view.type !== view) {
      setView(arg.view.type)
      save(VIEW_KEY, arg.view.type)
    }
  }

  function changeMode(m: ViewMode) {
    setMode(m)
    save(MODE_KEY, m)
  }

  if (!categories) {
    return error ? <p className="error">發生錯誤：{error}</p> : <p className="muted">載入中…</p>
  }

  const isTimeGrid = view.startsWith('timeGrid')
  // 手機：月曆填滿畫面（扣掉上方列、行事曆切換和下方分頁列）；電腦：月曆依內容自動長高
  const height = isNarrow ? 'calc(100dvh - 196px)' : isTimeGrid ? 'calc(100vh - 230px)' : 'auto'
  const openNew = (date: string) => setEditing({ kind: 'new', defaults: newDefaults(date) })

  const modeButtons: { id: ViewMode; label: string }[] = [
    { id: 'mine', label: '我的' },
    { id: 'shared', label: '共用' },
    ...(partner ? [{ id: 'partner' as const, label: `${partnerName}的` }] : []),
  ]

  return (
    <section className="calendar-page">
      <div className="cal-top">
        <div className="seg cal-modes" role="tablist" aria-label="行事曆">
          {modeButtons.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={activeMode === b.id}
              className={activeMode === b.id ? 'seg-btn active' : 'seg-btn'}
              onClick={() => changeMode(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        {!isNarrow && canEdit && (
          <button className="btn-primary" onClick={() => openNew(todayISO())}>
            ＋ 新增
          </button>
        )}
      </div>

      {activeMode === 'shared' && (
        <p className="legend muted small">
          {members
            .filter((m) => m.role !== 'viewer')
            .map((m) => {
              const b = memberBadge(m)
              return (
                <span key={m.user_id} className="legend-item">
                  <span className="dot" style={{ background: b.color }} />
                  {b.label}
                </span>
              )
            })}
          <span className="legend-item">
            <span className="dot legend-date" />
            約會
          </span>
          <span className="legend-item">
            <span className="legend-free">可約</span>
            12–22 點連續空 5 小時
          </span>
          <label className="switch legend-switch">
            <input
              type="checkbox"
              checked={showFree}
              onChange={(e) => {
                setShowFree(e.target.checked)
                save(FREE_KEY, e.target.checked ? 'on' : 'off')
              }}
            />
            <span>標出可約</span>
          </label>
        </p>
      )}

      {activeMode === 'shared' && showFree && upcoming && (
        <div className="upcoming">
          <span className="upcoming-title">接下來一週可約</span>
          {upcoming.length === 0 ? (
            <span className="muted small">沒有空滿 5 小時的日子</span>
          ) : (
            upcoming.map((d) => (
              <button key={d.date} className="upcoming-day" onClick={() => setSheetDate(d.date)} title={slotsText(d)}>
                <strong>{chipDate(d.date)}</strong>
                <span>連續 {hoursText(d.longestMinutes)}</span>
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="error">發生錯誤：{error}</p>}

      <div className="calendar-wrap">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          locale={zhTwLocale}
          firstDay={0}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          height={height}
          fixedWeekCount={false}
          // 項目都畫成淡色標籤；月曆只寫標題（時間點進去看）、日期只寫數字
          eventDisplay="block"
          views={{
            dayGridMonth: { displayEventTime: false, dayCellContent: (arg) => arg.date.getDate() },
          }}
          events={fetchEvents}
          editable={canEdit && !isTouch}
          selectable={canEdit && !isTouch}
          selectMinDistance={6}
          selectMirror
          select={handleSelect}
          dateClick={handleDateClick}
          dayCellDidMount={(arg) => {
            if (availableDays.current.has(toISODate(arg.date))) arg.el.classList.add('is-available')
          }}
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          datesSet={handleDatesSet}
          nowIndicator
          dayMaxEvents
          slotEventOverlap={false}
          scrollTime="07:00:00"
          allDayText="整天"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </div>

      {isNarrow && canEdit && (
        <button className="fab" onClick={() => openNew(todayISO())} aria-label="新增">
          ＋
        </button>
      )}

      {detail && <BusyDetail block={detail} categories={categories} onClose={() => setDetail(null)} />}

      {sheetDate && (
        <DaySheet
          date={sheetDate}
          mode={activeMode}
          showFree={activeMode === 'shared' && showFree}
          categories={categories}
          members={members}
          canEdit={canEdit}
          onClose={() => setSheetDate(null)}
          onOpen={(occ) => {
            setSheetDate(null)
            setEditing({ kind: 'occ', occ })
          }}
          onView={(occ) => {
            setSheetDate(null)
            setDetail(singleBlock(occ))
          }}
          onAdd={(date) => {
            setSheetDate(null)
            openNew(date)
          }}
        />
      )}

      {editing && (
        <OccurrenceEditor target={editing} categories={categories} onClose={() => setEditing(null)} onChanged={refetch} />
      )}
    </section>
  )
}
