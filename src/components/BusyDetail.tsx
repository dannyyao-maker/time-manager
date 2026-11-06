import type { Category } from '../data/types'
import { itemLabel, itemColor } from '../data/categories'
import type { BusyBlock } from '../lib/busy'
import { formatShortDate, formatTime } from '../lib/dates'
import { addDaysISO } from '../lib/recurrence'
import Modal from './Modal'

type Props = { block: BusyBlock; categories: Category[]; onClose: () => void }

function rangeText(b: BusyBlock) {
  if (b.allDay) {
    const last = addDaysISO(b.end, -1)
    return last === b.start ? `${formatShortDate(b.start)} 整天` : `${formatShortDate(b.start)}–${formatShortDate(last)} 整天`
  }
  const [sd, st] = b.start.split('T')
  const [ed, et] = b.end.split('T')
  return sd === ed ? `${formatShortDate(sd)} ${st}–${et}` : `${formatShortDate(sd)} ${st} – ${formatShortDate(ed)} ${et}`
}

// 女友點忙碌時段：看裡面是什麼（只能看，不能改）
export default function BusyDetail({ block, categories, onClose }: Props) {
  return (
    <Modal title={rangeText(block)} onClose={onClose}>
      <ul className="sheet-list">
        {block.items.map((o) => (
          <li key={o.key} className="sheet-row static">
            <span className="sheet-time">
              {o.start_time ? (
                <>
                  <span>{formatTime(o.start_time)}</span>
                  {o.end_time && <span className="muted">{formatTime(o.end_time)}</span>}
                </>
              ) : (
                <span className="muted">整天</span>
              )}
            </span>
            <span className="sheet-bar" style={{ background: itemColor(o, categories) }} />
            <span className="sheet-main">
              <span className="item-title">{o.title}</span>
              <span className="muted small">
                {itemLabel(o, categories)}
                {o.end_date !== o.start_date && ` · ${formatShortDate(o.start_date)}–${formatShortDate(o.end_date)}`}
                {o.location && ` · ${o.location}`}
              </span>
              {o.note && <span className="item-note">{o.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
