import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  disabled?: boolean
  onCommit: (color: string) => void
}

// 顏色選擇器：拖動時只改畫面，選定（關掉選色器）後才存進資料庫一次
export default function ColorField({ value, disabled, onCommit }: Props) {
  const [local, setLocal] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  const latest = useRef({ local, value, onCommit })
  latest.current = { local, value, onCommit }

  useEffect(() => setLocal(value), [value])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 原生的 change 事件：使用者選定顏色後才觸發一次
    const handle = () => {
      const { local, value, onCommit } = latest.current
      if (el.value !== value) onCommit(el.value)
      else if (local !== value) setLocal(value)
    }
    el.addEventListener('change', handle)
    return () => el.removeEventListener('change', handle)
  }, [])

  return (
    <input
      ref={ref}
      type="color"
      className="color-input"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      title="改顏色"
      disabled={disabled}
    />
  )
}
