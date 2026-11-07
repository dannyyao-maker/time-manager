import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { SCENES } from './scenes'
import './tour.css'

type Props = { onClose: () => void }

const PHONE_W = 280
const PHONE_H = 580

// 導覽：像影片一樣自動播放（鏡頭放大、縮小、滑動），也可以左右滑、點兩側切換、按略過
export default function Tour({ onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [fit, setFit] = useState(1)
  const start = useRef<{ x: number; y: number } | null>(null)
  const scene = SCENES[index]
  const last = index === SCENES.length - 1

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = i + delta
        if (next >= SCENES.length) {
          onClose()
          return i
        }
        return Math.max(0, next)
      })
    },
    [onClose],
  )

  // 自動播放：時間到就換下一個畫面（最後一個停住，等使用者按「開始使用」）
  useEffect(() => {
    if (last) return
    const t = window.setTimeout(() => go(1), scene.duration)
    return () => window.clearTimeout(t)
  }, [index, last, scene.duration, go])

  // 手機框依螢幕大小縮放
  useEffect(() => {
    const update = () =>
      setFit(Math.min(1, (window.innerHeight - 250) / PHONE_H, (window.innerWidth - 40) / PHONE_W))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // 鍵盤：← → 切換、Esc 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  // 左右滑動切換；只是點一下的話，點左半邊上一個、右半邊下一個
  function onPointerDown(e: PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY }
  }
  function onPointerUp(e: PointerEvent) {
    const s = start.current
    start.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) go(e.clientX < window.innerWidth / 2 ? -1 : 1)
  }

  const Scene = scene.Screen

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="使用導覽">
      <div className="tour-progress" aria-hidden>
        {SCENES.map((s, i) => (
          <span key={s.id} className="tour-bar">
            <span
              key={i === index ? `on-${index}` : 'off'}
              className={i < index ? 'tour-fill done' : i === index ? 'tour-fill active' : 'tour-fill'}
              style={i === index ? { animationDuration: `${s.duration}ms` } : undefined}
            />
          </span>
        ))}
      </div>

      <button className="tour-skip" onClick={onClose}>
        {last ? '關閉' : '略過'}
      </button>

      <div className="tour-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="tour-text" key={`t-${index}`}>
          <h2 className="tour-title">{scene.title}</h2>
          <p className="tour-sub">{scene.sub}</p>
        </div>

        <div className="tour-phone-wrap" style={{ width: PHONE_W * fit, height: PHONE_H * fit }}>
          <div className="tour-phone" style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${fit})` }}>
            <div className="tour-screen">
              <Scene key={`s-${index}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="tour-foot">
        <span className="tour-count" aria-live="polite">
          {index + 1} / {SCENES.length}
        </span>
        {last ? (
          <button className="btn-primary tour-cta" onClick={onClose}>
            開始使用
          </button>
        ) : (
          <button className="btn-secondary tour-next" onClick={() => go(1)}>
            下一步
          </button>
        )}
      </div>
    </div>
  )
}
