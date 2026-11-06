import { useEffect, useRef, type KeyboardEvent } from 'react'

const ITEM_H = 40 // 每一格的高度（px）
const VISIBLE = 5 // 看得到幾格（中間那格是選中的）

type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  label: string // 給螢幕閱讀器的名稱，例如「小時」
}

// 一欄滾輪：上下滑動選擇，停下來時中間那格就是選中的值（像 iPhone 鬧鐘）
export function WheelColumn({ options, value, onChange, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  // 外部的值改變時，捲到那一格
  useEffect(() => {
    const el = ref.current
    if (el && Math.abs(el.scrollTop - index * ITEM_H) > 2) el.scrollTop = index * ITEM_H
  }, [index])

  function handleScroll() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
      if (options[i].value !== value) onChange(options[i].value)
    }, 110)
  }

  function pick(i: number) {
    ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
    if (options[i].value !== value) onChange(options[i].value)
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      pick(index - 1)
    } else if (e.key === 'ArrowDown' && index < options.length - 1) {
      e.preventDefault()
      pick(index + 1)
    }
  }

  return (
    <div
      ref={ref}
      className="wheel-col"
      style={{ height: ITEM_H * VISIBLE }}
      onScroll={handleScroll}
      onKeyDown={handleKey}
      tabIndex={0}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${label}-${index}`}
    >
      <div style={{ height: ITEM_H * 2 }} aria-hidden />
      {options.map((o, i) => (
        <div
          key={o.value}
          id={`${label}-${i}`}
          role="option"
          aria-selected={i === index}
          className={i === index ? 'wheel-item selected' : 'wheel-item'}
          style={{ height: ITEM_H }}
          onClick={() => pick(i)}
        >
          {o.label}
        </div>
      ))}
      <div style={{ height: ITEM_H * 2 }} aria-hidden />
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS: Option[] = Array.from({ length: 24 }, (_, h) => ({ value: pad(h), label: pad(h) }))

// 分鐘選項：每 5 分鐘一格；如果目前的值不在格子上（例如 10:23），也保留它，免得被偷偷改掉
export function minuteOptions(current: string): Option[] {
  const list = Array.from({ length: 12 }, (_, i) => pad(i * 5))
  if (current && !list.includes(current)) list.push(current)
  return list.sort().map((m) => ({ value: m, label: m }))
}

type TimeProps = { value: string; onChange: (hhmm: string) => void }

// 時間滾輪：小時（00–23）＋分鐘（每 5 分鐘）
export default function TimeWheel({ value, onChange }: TimeProps) {
  const [h, m] = (value || '09:00').split(':')
  return (
    <div className="wheel">
      <div className="wheel-highlight" aria-hidden />
      <WheelColumn options={HOURS} value={h} onChange={(nh) => onChange(`${nh}:${m}`)} label="小時" />
      <span className="wheel-colon" aria-hidden>
        :
      </span>
      <WheelColumn options={minuteOptions(m)} value={m} onChange={(nm) => onChange(`${h}:${nm}`)} label="分鐘" />
    </div>
  )
}
