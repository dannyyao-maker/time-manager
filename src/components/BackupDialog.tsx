import { useState } from 'react'
import { backupToCsv, downloadFile, fetchBackup } from '../data/export'
import { todayISO } from '../lib/dates'
import Modal from './Modal'

type Props = { onClose: () => void }

// 匯出備份：資料只存在雲端資料庫，建議每週下載一次存在自己的電腦或雲端硬碟
export default function BackupDialog({ onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function exportAll() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const b = await fetchBackup()
      const stamp = todayISO()
      downloadFile(`time-manager-備份-${stamp}.json`, JSON.stringify(b, null, 2), 'application/json')
      downloadFile(`time-manager-項目-${stamp}.csv`, backupToCsv(b), 'text/csv;charset=utf-8')
      setMessage(`已下載：${b.items.length} 筆項目、${b.categories.length} 個類別、${b.occurrence_overrides.length} 筆單次修改、${b.memos.length} 筆備忘錄。`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="匯出備份" onClose={onClose}>
      <p>會下載兩個檔案：</p>
      <ul className="backup-list">
        <li>
          <strong>.json</strong>：完整備份（項目、類別、重複項目的單次修改、備忘錄），之後可以用來還原。
        </li>
        <li>
          <strong>.csv</strong>：用 Excel 打開就能看的項目清單。
        </li>
      </ul>
      <p className="muted small">
        建議每週下載一次，存在電腦或雲端硬碟。檔案裡是你的私人行程，不要放進專案資料夾或上傳 GitHub。
      </p>
      {message && <p className="form-note">{message}</p>}
      {error && <p className="error">匯出失敗：{error}</p>}
      <div className="form-actions">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          關閉
        </button>
        <button className="btn-primary" onClick={exportAll} disabled={busy}>
          {busy ? '匯出中…' : '下載備份'}
        </button>
      </div>
    </Modal>
  )
}
