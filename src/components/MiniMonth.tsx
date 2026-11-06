import { useState } from 'react'
import { parseISODate, toISODate, todayISO } from '../lib/dates'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

type Props = {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  min?: string // 不能選這天以前（例如結束日期不能早於開始日期）
}

// 小月曆：點日期選擇（一週從週日開始），參考 TimeTree
export default function MiniMonth({ value, onChange, min }: Props) {
  const start = parseISODate(value || todayISO())
  const [ym, setYm] = useState({ y: start.getFullYear(), m: start.getMonth() })
  const today = todayISO()

  const first = new Date(ym.y, ym.m, 1)
  const gridStart = new Date(ym.y, ym.m, 1 - first.getDay()) // 往前補到週日
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7

  const move = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div className="mini-month">
      <div className="mini-head">
        <strong>
          {ym.y}年{ym.m + 1}月
        </strong>
        <span>
          <button type="button" className="btn-icon" onClick={() => move(-1)} aria-label="上個月">
            ‹
          </button>
          <button type="button" className="btn-icon" onClick={() => move(1)} aria-label="下個月">
            ›
          </button>
        </span>
      </div>
      <div className="mini-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={i === 0 ? 'mini-wd sun' : 'mini-wd'}>
            {w}
          </span>
        ))}
        {Array.from({ length: cells }, (_, i) => {
          const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
          const iso = toISODate(d)
          const inMonth = d.getMonth() === ym.m
          const disabled = !!min && iso < min
          const cls = ['mini-day']
          if (!inMonth) cls.push('other')
          if (iso === today) cls.push('today')
          if (iso === value) cls.push('selected')
          if (d.getDay() === 0) cls.push('sun')
          return (
            <button
              type="button"
              key={iso}
              className={cls.join(' ')}
              disabled={disabled}
              onClick={() => onChange(iso)}
              aria-label={`${d.getMonth() + 1}月${d.getDate()}日`}
              aria-pressed={iso === value}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
