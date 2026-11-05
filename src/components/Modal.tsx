import { useEffect, type ReactNode } from 'react'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
}

// 跳出視窗：按背景或 Esc 關閉
export default function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
