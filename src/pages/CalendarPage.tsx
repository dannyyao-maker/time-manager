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
import { listAvatars, SHARED_AVATAR, type Avatars } from '../data/avatars'
import { SHARED_COLOR } from '../data/categories'
import Avatar from '../components/Avatar'
import TabIcon from '../components/TabIcon'
import { signOut } from '../hooks/useAuth'
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

type Props = { canEdit: boolean; onOpenSettings?: () => void }

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

// 手機上方的標題：月曆、週曆只寫「2026年11月」（週曆用那週中間那天的月份），日曆寫「11月9日（一）」
function shortTitle(arg: DatesSetArg): string {
  const start = arg.view.currentStart
  if (arg.view.type === 'timeGridDay') {
    return `${start.getMonth() + 1}月${start.getDate()}日（${'日一二三四五六'[start.getDay()]}）`
  }
  const mid = arg.view.type === 'timeGridWeek' ? new Date(start.getTime() + 3 * 86400000) : start
  return `${mid.getFullYear()}年${mid.getMonth() + 1}月`
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

export default function CalendarPage({ canEdit, onOpenSettings }: Props) {
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
  const [title, setTitle] = useState('') // 目前顯示的月份（手機放在畫面最上面）
  const [avatars, setAvatars] = useState<Avatars>({})
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
    listAvatars().then(setAvatars)
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
    setTitle(shortTitle(arg))
    if (arg.view.type !== view) {
      setView(arg.view.type)
      save(VIEW_KEY, arg.view.type)
    }
  }

  // 手機：在行事曆上左右滑，切到下一個／上一個月（週曆、日曆也一樣）
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const [slide, setSlide] = useState<'' | 'from-right' | 'from-left'>('')
  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    swipe.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // 夠長、夠快、而且明顯是橫的（直的是捲動，不算）
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - start.t > 800) return
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (dx < 0) api.next()
    else api.prev()
    setSlide(dx < 0 ? 'from-right' : 'from-left')
  }

  function changeMode(m: ViewMode) {
    setMode(m)
    save(MODE_KEY, m)
  }

  if (!categories) {
    return error ? <p className="error">發生錯誤：{error}</p> : <p className="muted">載入中…</p>
  }

  const isTimeGrid = view.startsWith('timeGrid')
  // 手機：整頁固定在螢幕大小，月曆填滿剩下的空間（不會上下晃）；電腦：月曆依內容自動長高
  const height = isNarrow ? '100%' : isTimeGrid ? 'calc(100vh - 230px)' : 'auto'
  const openNew = (date: string) => setEditing({ kind: 'new', defaults: newDefaults(date) })
  const api = () => calendarRef.current?.getApi()

  const myBadge = memberBadge(members.find((m) => m.user_id === me))
  const partnerBadge = partner ? memberBadge(partner) : null
  const modeButtons: { id: ViewMode; label: string; image?: string; letter: string; color: string }[] = [
    { id: 'mine', label: '我的', image: me ? avatars[me] : undefined, letter: myBadge.label, color: myBadge.color },
    { id: 'shared', label: '共用', image: avatars[SHARED_AVATAR], letter: '約', color: SHARED_COLOR },
    ...(partner && partnerBadge
      ? [{ id: 'partner' as const, label: `${partnerName}的`, image: avatars[partner.user_id], letter: partnerBadge.label, color: partnerBadge.color }]
      : []),
  ]

  const viewButtons = [
    { id: 'dayGridMonth', label: '月' },
    { id: 'timeGridWeek', label: '週' },
    { id: 'timeGridDay', label: '天' },
  ]

  const freeSwitch = (
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
  )

  const upcomingDays =
    upcoming &&
    (upcoming.length === 0 ? (
      <span className="muted small">沒有空滿 5 小時的日子</span>
    ) : (
      upcoming.map((d) => (
        <button key={d.date} className="upcoming-day" onClick={() => setSheetDate(d.date)} title={slotsText(d)}>
          <strong>{chipDate(d.date)}</strong>
          <span>連續 {hoursText(d.longestMinutes)}</span>
        </button>
      ))
    ))

  return (
    <section className="calendar-page">
      {isNarrow && (
        <div className="m-cal-head">
          <h1 className="m-cal-title">{title}</h1>
          <button className="m-today" onClick={() => api()?.today()}>
            今天
          </button>
          <div className="seg seg-small m-views" role="tablist" aria-label="檢視">
            {viewButtons.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={view === v.id ? 'seg-btn active' : 'seg-btn'}
                onClick={() => api()?.changeView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          {canEdit && onOpenSettings ? (
            <button className="btn-icon m-settings" onClick={onOpenSettings} aria-label="設定">
              <TabIcon name="settings" />
            </button>
          ) : (
            <button className="btn-secondary btn-small" onClick={() => signOut()}>
              登出
            </button>
          )}
        </div>
      )}

      <div className="cal-top">
        <div className="cal-chips" role="tablist" aria-label="行事曆">
          {modeButtons.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={activeMode === b.id}
              className={activeMode === b.id ? 'cal-chip active' : 'cal-chip'}
              onClick={() => changeMode(b.id)}
            >
              <Avatar image={b.image} letter={b.letter} color={b.color} size={isNarrow ? 24 : 28} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
        {!isNarrow && canEdit && (
          <button className="btn-primary" onClick={() => openNew(todayISO())}>
            ＋ 新增
          </button>
        )}
      </div>

      {activeMode === 'shared' && !isNarrow && (
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
          {freeSwitch}
        </p>
      )}

      {activeMode === 'shared' && !isNarrow && showFree && upcoming && (
        <div className="upcoming">
          <span className="upcoming-title">接下來一週可約</span>
          {upcomingDays}
        </div>
      )}

      {/* 手機：共用行事曆只用一行放「可約」開關和接下來一週可約的日子 */}
      {activeMode === 'shared' && isNarrow && (
        <div className="m-free-row">
          {freeSwitch}
          {showFree && upcoming && <div className="m-free-days">{upcomingDays}</div>}
        </div>
      )}

      {error && <p className="error">發生錯誤：{error}</p>}

      <div
        className={['calendar-wrap', view === 'dayGridMonth' && 'is-month', slide && `slide-${slide}`].filter(Boolean).join(' ')}
        onTouchStart={isTouch ? handleTouchStart : undefined}
        onTouchEnd={isTouch ? handleTouchEnd : undefined}
        onAnimationEnd={() => setSlide('')}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          locale={zhTwLocale}
          firstDay={0}
          // 手機：月份、今天、月／週／天都在上面自己做的標題列；左右滑換月
          headerToolbar={
            isNarrow
              ? false
              : {
                  left: isTouch ? 'today' : 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }
          }
          moreLinkContent={(arg) => (isNarrow ? `+${arg.num}` : `還有 ${arg.num} 筆`)}
          height={height}
          fixedWeekCount={false}
          // 項目都畫成淡色標籤；月曆只寫標題（時間點進去看）、日期只寫數字
          eventDisplay="block"
          // 同一天：紀念日 → 行程 → 待辦
          eventOrder="rank,start,-duration,allDay,title"
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
