import { useCallback, useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
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
import { addDays, eventToTiming, itemToEvent, itemToInput, selectionToDefaults } from '../lib/calendarEvents'
import { toISODate, todayISO } from '../lib/dates'
import OccurrenceEditor, { type EditTarget } from '../components/OccurrenceEditor'
import DaySheet from '../components/DaySheet'
import BusyDetail from '../components/BusyDetail'
import { mergeBusy, type BusyBlock } from '../lib/busy'
import { shade, tint } from '../lib/color'

const BUSY_COLOR = '#8C837B'

// 忙碌時段 → 行事曆事件（灰色、不顯示內容）
function busyToEvent(block: BusyBlock, i: number): EventInput {
  return {
    id: `busy-${i}`,
    title: block.allDay ? '整天：有安排' : '忙碌',
    start: block.start,
    end: block.end,
    allDay: block.allDay,
    backgroundColor: tint(BUSY_COLOR, 0.22),
    borderColor: BUSY_COLOR,
    textColor: shade(BUSY_COLOR, 0.35),
    classNames: ['is-busy'],
    extendedProps: { block },
  }
}
import { useIsNarrow, useIsTouch } from '../hooks/useMedia'
import type { DateClickArg } from '@fullcalendar/interaction'

type Props = { canEdit: boolean }

const VIEW_KEY = 'tm.calendarView'
const VIEWS = ['dayGridMonth', 'timeGridWeek', 'timeGridDay']

// 記住上次看的是月／週／日（只存在這台裝置的瀏覽器）
function loadView(): string {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v && VIEWS.includes(v)) return v
  } catch {
    // 無痕模式等情況讀不到，用預設值
  }
  return 'dayGridMonth'
}

function saveView(v: string) {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // 存不了也沒關係
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function CalendarPage({ canEdit }: Props) {
  const calendarRef = useRef<FullCalendar>(null)
  const [categories, setCategories] = useState<Category[] | null>(null)
  const categoriesRef = useRef<Category[]>([])
  const [view, setView] = useState(loadView)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [sheetDate, setSheetDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isNarrow = useIsNarrow()
  const isTouch = useIsTouch()
  // 只能看的人：預設只看空閒／忙碌；打開「顯示細節」才看到內容
  const [showDetails, setShowDetails] = useState(false)
  const busyModeRef = useRef(!canEdit)
  busyModeRef.current = !canEdit && !showDetails
  const [busyDetail, setBusyDetail] = useState<BusyBlock | null>(null)

  useEffect(() => {
    calendarRef.current?.getApi().refetchEvents()
  }, [showDetails])

  useEffect(() => {
    listCategories()
      .then((cats) => {
        categoriesRef.current = cats
        setCategories(cats)
      })
      .catch((e) => setError(errMsg(e)))
  }, [])

  const refetch = () => calendarRef.current?.getApi().refetchEvents()

  // 行事曆換到哪段日期，就去資料庫拿那段日期的項目
  const fetchEvents = useCallback(
    (
      info: EventSourceFuncArg,
      success: (events: EventInput[]) => void,
      failure: (error: Error) => void,
    ) => {
      const from = toISODate(info.start)
      const to = addDays(toISODate(info.end), -1)
      listOccurrences(from, to)
        .then((occs) => {
          setError(null)
          // 女友檢視（預設）：只顯示合併後的忙碌時段
          if (busyModeRef.current) success(mergeBusy(occs).map(busyToEvent))
          else success(occs.map((occ) => itemToEvent(occ, categoriesRef.current)))
        })
        .catch((e) => {
          setError(errMsg(e))
          failure(e instanceof Error ? e : new Error(String(e)))
        })
    },
    [],
  )

  function handleSelect(arg: DateSelectArg) {
    arg.view.calendar.unselect()
    if (!canEdit) return
    setEditing({ kind: 'new', defaults: selectionToDefaults(arg.start, arg.end, arg.allDay) })
  }

  function handleEventClick(arg: EventClickArg) {
    const block = arg.event.extendedProps.block as BusyBlock | undefined
    if (block) {
      setBusyDetail(block)
      return
    }
    const occ = arg.event.extendedProps.item as Occurrence
    if (canEdit) {
      setEditing({ kind: 'occ', occ })
    } else {
      // 只能看：顯示這一筆的細節
      const allDay = !occ.start_time
      setBusyDetail({
        allDay,
        start: allDay ? occ.start_date : `${occ.start_date}T${occ.start_time!.slice(0, 5)}`,
        end: allDay ? addDays(occ.end_date, 1) : `${occ.end_date}T${(occ.end_time ?? occ.start_time!).slice(0, 5)}`,
        items: [occ],
      })
    }
  }

  // 拖拉移動或拉長：直接存回資料庫；失敗就還原
  // 重複項目拖拉時，只移動這一次
  async function handleEventChange(arg: EventChangeArg) {
    const occ = arg.event.extendedProps.item as Occurrence
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

  // 手機：點一下某天 → 從下方滑出這天的清單
  function handleDateClick(arg: DateClickArg) {
    if (!isTouch) return
    setSheetDate(toISODate(arg.date))
  }

  function handleDatesSet(arg: DatesSetArg) {
    if (arg.view.type !== view) {
      setView(arg.view.type)
      saveView(arg.view.type)
    }
  }

  if (!categories) {
    return error ? <p className="error">發生錯誤：{error}</p> : <p className="muted">載入中…</p>
  }

  const isTimeGrid = view.startsWith('timeGrid')
  // 手機：月曆填滿畫面（扣掉上方工具列和下方分頁列）；電腦：月曆依內容自動長高
  const height = isNarrow ? 'calc(100dvh - 150px)' : isTimeGrid ? 'calc(100vh - 190px)' : 'auto'
  const openNew = (date: string) => setEditing({ kind: 'new', defaults: { startDate: date } })

  return (
    <section className="calendar-page">
      {!isNarrow && (
        <div className="page-title">
          <h1>行事曆</h1>
          {canEdit && (
            <button className="btn-primary" onClick={() => openNew(todayISO())}>
              ＋ 新增項目
            </button>
          )}
        </div>
      )}

      {error && <p className="error">發生錯誤：{error}</p>}

      {!canEdit && (
        <div className="viewer-bar">
          <span className="muted small">
            {showDetails ? '正在顯示行程內容' : '灰色＝忙碌；點一下可以看是什麼'}
          </span>
          <label className="switch">
            <input type="checkbox" checked={showDetails} onChange={(e) => setShowDetails(e.target.checked)} />
            <span>顯示細節</span>
          </label>
        </div>
      )}

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
          selectMirror
          select={handleSelect}
          dateClick={handleDateClick}
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
        <button className="fab" onClick={() => openNew(todayISO())} aria-label="新增項目">
          ＋
        </button>
      )}

      {busyDetail && (
        <BusyDetail block={busyDetail} categories={categories} onClose={() => setBusyDetail(null)} />
      )}

      {sheetDate && (
        <DaySheet
          date={sheetDate}
          categories={categories}
          canEdit={canEdit}
          onClose={() => setSheetDate(null)}
          onOpen={(occ) => {
            setSheetDate(null)
            setEditing({ kind: 'occ', occ })
          }}
          onAdd={(date) => {
            setSheetDate(null)
            openNew(date)
          }}
        />
      )}

      {editing && (
        <OccurrenceEditor
          target={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onChanged={refetch}
        />
      )}
    </section>
  )
}
