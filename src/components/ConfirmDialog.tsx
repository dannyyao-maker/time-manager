import { useState, type ReactNode } from 'react'
import Modal from './Modal'

type Props = {
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-message">{message}</div>
      {error && <p className="error">操作失敗：{error}</p>}
      <div className="form-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>
          取消
        </button>
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? '處理中…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
