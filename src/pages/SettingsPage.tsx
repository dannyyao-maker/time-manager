import { useState } from 'react'
import CategoriesPage from './CategoriesPage'
import BackupDialog from '../components/BackupDialog'

type Props = { canEdit: boolean; isPartner: boolean; onShowTour: () => void }

// 設定：類別（標籤）管理、匯出備份（從下方分頁移到這裡，比較少用到）
export default function SettingsPage({ canEdit, isPartner, onShowTour }: Props) {
  const [showBackup, setShowBackup] = useState(false)
  return (
    <div className="settings">
      <CategoriesPage canEdit={canEdit} isPartner={isPartner} />

      {canEdit && (
        <section className="narrow settings-section">
          <h2>備份</h2>
          <p className="muted small">下載所有資料（JSON 完整備份＋可用 Excel 打開的 CSV）。建議每週一次。</p>
          <button className="btn-secondary" onClick={() => setShowBackup(true)}>
            匯出備份
          </button>
        </section>
      )}

      <section className="narrow settings-section">
        <h2>使用導覽</h2>
        <p className="muted small">一分鐘看完主要功能：三個行事曆、新增、備忘錄、可約。</p>
        <button className="btn-secondary" onClick={onShowTour}>
          看導覽
        </button>
      </section>

      {showBackup && <BackupDialog onClose={() => setShowBackup(false)} />}
    </div>
  )
}
