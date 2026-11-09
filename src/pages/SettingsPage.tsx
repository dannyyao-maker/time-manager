import { useEffect, useRef, useState } from 'react'
import CategoriesPage from './CategoriesPage'
import BackupDialog from '../components/BackupDialog'
import Avatar from '../components/Avatar'
import { fileToAvatar, listAvatars, removeAvatar, saveAvatar, SHARED_AVATAR, type Avatars } from '../data/avatars'
import { listMembers, memberBadge, type Member } from '../data/members'
import { SHARED_COLOR } from '../data/categories'
import { getCurrentUserId } from '../lib/session'
import { signOut } from '../hooks/useAuth'

type Props = { canEdit: boolean; isPartner: boolean; onShowTour: () => void }

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// 行事曆頭貼：自己的、共用的可以換；對方的由對方自己換
function AvatarSettings() {
  const me = getCurrentUserId()
  const [avatars, setAvatars] = useState<Avatars>({})
  const [members, setMembers] = useState<Member[]>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const target = useRef<string | null>(null)

  useEffect(() => {
    listAvatars().then(setAvatars)
    listMembers().then(setMembers).catch(() => setMembers([]))
  }, [])

  if (!me) return null
  const myBadge = memberBadge(members.find((m) => m.user_id === me))
  const rows = [
    { key: me, label: `我的（${myBadge.label}）`, hint: '對方切到你的行事曆時也會看到這張', letter: myBadge.label, color: myBadge.color },
    { key: SHARED_AVATAR, label: '共用', hint: '兩個人都可以換', letter: '約', color: SHARED_COLOR },
  ]

  function pick(key: string) {
    target.current = key
    fileInput.current?.click()
  }

  async function onFile(file: File | undefined) {
    const key = target.current
    if (!file || !key) return
    setBusyKey(key)
    setError(null)
    try {
      const image = await fileToAvatar(file)
      await saveAvatar(key, image)
      setAvatars((a) => ({ ...a, [key]: image }))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusyKey(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function onRemove(key: string) {
    setBusyKey(key)
    setError(null)
    try {
      await removeAvatar(key)
      setAvatars((a) => {
        const next = { ...a }
        delete next[key]
        return next
      })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="narrow settings-section">
      <h2>行事曆頭貼</h2>
      <p className="muted small">顯示在行事曆上方的切換鈕。選一張照片，會自動裁成圓形。</p>
      <ul className="avatar-list">
        {rows.map((r) => (
          <li key={r.key} className="avatar-row">
            <Avatar image={avatars[r.key]} letter={r.letter} color={r.color} size={44} />
            <span className="avatar-text">
              <strong>{r.label}</strong>
              <span className="muted small">{r.hint}</span>
            </span>
            <span className="avatar-actions">
              {avatars[r.key] && (
                <button className="btn-ghost btn-small" onClick={() => onRemove(r.key)} disabled={busyKey !== null}>
                  移除
                </button>
              )}
              <button className="btn-secondary btn-small" onClick={() => pick(r.key)} disabled={busyKey !== null}>
                {busyKey === r.key ? '處理中…' : avatars[r.key] ? '更換' : '選照片'}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="error">{error.includes('calendar_avatars') ? '資料庫還沒更新（需要執行 0006）' : error}</p>}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </section>
  )
}

// 設定：類別、行事曆頭貼、備份、導覽、登出
export default function SettingsPage({ canEdit, isPartner, onShowTour }: Props) {
  const [showBackup, setShowBackup] = useState(false)
  return (
    <div className="settings">
      <CategoriesPage canEdit={canEdit} isPartner={isPartner} />

      {canEdit && <AvatarSettings />}

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

      <section className="narrow settings-section">
        <h2>帳號</h2>
        <button className="btn-secondary" onClick={() => signOut()}>
          登出
        </button>
      </section>

      {showBackup && <BackupDialog onClose={() => setShowBackup(false)} />}
    </div>
  )
}
