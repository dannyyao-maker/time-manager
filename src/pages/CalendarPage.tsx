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
import type { Category, Item } from '../data/types'
import { listCategories } from '../data/categories'
import { createItem, deleteItem, listItemsInRange, updateItem } from '../data/items'
import {
  addDays,
  eventToTiming,
  itemToEvent,
  itemToInput,
  selectionToDefaults,
  type ItemDefaults,
} from '../lib/calendarEvents'
import { toISODate, todayISO } from '../lib/dates'
import ItemForm from '../components/ItemForm'

type Props = { canEdit: boolean }

type Editing = { item: Item } | { defaults: ItemDefaults } | null

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
  const [editing, setEditing] = useState<Editing>(null)
  const [error, setError] = useState<string | null>(null)

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
      listItemsInRange(from, to)
        .then((items) => {
          setError(null)
          success(items.map((item) => itemToEvent(item, categoriesRef.current)))
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
    setEditing({ defaults: selectionToDefaults(arg.start, arg.end, arg.allDay) })
  }

  function handleEventClick(arg: EventClickArg) {
    if (!canEdit) return
    setEditing({ item: arg.event.extendedProps.item as Item })
  }

  // 拖拉移動或拉長：直接存回資料庫；失敗就還原
  async function handleEventChange(arg: EventChangeArg) {
    const item = arg.event.extendedProps.item as Item
    const timing = eventToTiming(arg.event.start!, arg.event.end, arg.event.allDay)
    try {
      await updateItem(item.id, { ...itemToInput(item), ...timing })
      refetch()
    } catch (e) {
      arg.revert()
      setError(errMsg(e))
    }
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

  return (
    <section className="calendar-page">
      <div className="page-title">
        <h1>行事曆</h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => setEditing({ defaults: { startDate: todayISO() } })}>
            ＋ 新增項目
          </button>
        )}
      </div>

      {error && <p className="error">發生錯誤：{error}</p>}
      {canEdit && (
        <p className="muted small calendar-hint">
          點一下日期或時段新增；拖拉一段可以一次選多天或一段時間；拖動項目可以改時間。
        </p>
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
          height={isTimeGrid ? 'calc(100vh - 210px)' : 'auto'}
          events={fetchEvents}
          editable={canEdit}
          selectable={canEdit}
          selectMirror
          select={handleSelect}
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

      {editing && (
        <ItemForm
          item={'item' in editing ? editing.item : null}
          defaults={'defaults' in editing ? editing.defaults : { startDate: todayISO() }}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if ('item' in editing) await updateItem(editing.item.id, input)
            else await createItem(input)
            setEditing(null)
            refetch()
          }}
          onDelete={
            'item' in editing
              ? async () => {
                  await deleteItem(editing.item.id)
                  setEditing(null)
                  refetch()
                }
              : undefined
          }
        />
      )}
    </section>
  )
}
