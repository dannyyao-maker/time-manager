import { useEffect, useRef, useState } from 'react'
import CategoriesPage from './CategoriesPage'
import BackupDialog from '../components/BackupDialog'
import Avatar from '../components/Avatar'
import { fileToAvatar, listAvatars, removeAvatar, saveAvatar, SHARED_AVATAR, type Avatars } from '../data/avatars'
import { listMembers, memberBadge, type Member } from '../data/members'
import { SHARED_COLOR } from '../data/categories'
import { getCurrentUserId } from '../lib/session'
import { signOut } from '../hooks/useAuth'
import { createWidgetToken, hasWidgetToken, revokeWidgetToken } from '../data/widget'
import { buildWidgetScript } from '../lib/widgetScript'

type Props = { canEdit: boolean; isPartner: boolean; onShowTour: () => void }

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// iPhone 主畫面小工具（用 Scriptable App）：產生密碼 → 複製程式 → 貼到 Scriptable
function WidgetSettings() {
  const [status, setStatus] = useState<boolean | null | undefined>(undefined) // undefined = 讀取中
  const [script, setScript] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    hasWidgetToken().then(setStatus)
  }, [])

  async function generate() {
    setBusy(true)
    setError(null)
    setConfirming(false)
    try {
      const token = await createWidgetToken()
      setScript(
        buildWidgetScript({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
          publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          token,
          appUrl: window.location.origin,
        }),
      )
      setStatus(true)
      setCopied(false)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    setError(null)
    try {
      await revokeWidgetToken()
      setStatus(false)
      setScript(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!script) return
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
    } catch {
      setError('沒辦法自動複製，請長按下面的程式框，全選後複製')
    }
  }

  return (
    <section className="narrow settings-section">
      <h2>手機小工具（iPhone）</h2>
      <p className="muted small">
        在 iPhone 主畫面放「這週的我的行事曆」（自己的行程＋約會）。用免費的 Scriptable App 顯示，大約 15–30 分鐘更新一次。
      </p>

      {status === undefined && <p className="muted small">讀取中…</p>}
      {status === null && <p className="error">資料庫還沒更新（需要執行 0007）。</p>}

      {status !== undefined && status !== null && !script && (
        <div className="widget-actions">
          {status && <span className="widget-on">已開啟</span>}
          {status && !confirming && (
            <button className="btn-secondary" onClick={() => setConfirming(true)} disabled={busy}>
              重新產生密碼
            </button>
          )}
          {status && confirming && (
            <>
              <span className="small">舊的小工具會停止更新，要再貼一次新程式。確定？</span>
              <button className="btn-primary btn-small" onClick={generate} disabled={busy}>
                確定
              </button>
              <button className="btn-ghost btn-small" onClick={() => setConfirming(false)}>
                取消
              </button>
            </>
          )}
          {!status && (
            <button className="btn-primary" onClick={generate} disabled={busy}>
              {busy ? '產生中…' : '產生小工具程式'}
            </button>
          )}
          {status && !confirming && (
            <button className="btn-ghost btn-small" onClick={revoke} disabled={busy}>
              停用
            </button>
          )}
        </div>
      )}

      {script && (
        <div className="widget-setup">
          <p className="small">
            <strong>程式只會顯示這一次</strong>（裡面有你的小工具密碼，不要傳給別人）。照著做：
          </p>
          <ol className="widget-steps small">
            <li>在 App Store 下載免費的「Scriptable」。</li>
            <li>按下面的「複製程式」。</li>
            <li>打開 Scriptable → 右上角 ＋ → 貼上 → 上方把名稱改成「Time Manager」→ 完成。</li>
            <li>回主畫面長按空白處 → 左上角 ＋ → 搜尋「Scriptable」→ 選「中」或「大」→ 加入小工具。</li>
            <li>長按剛加的小工具 → 編輯小工具 → Script 選「Time Manager」。</li>
          </ol>
          <div className="widget-actions">
            <button className="btn-primary" onClick={copy}>
              {copied ? '已複製 ✓' : '複製程式'}
            </button>
            <button className="btn-ghost btn-small" onClick={() => setScript(null)}>
              完成
            </button>
          </div>
          <textarea className="widget-code" readOnly value={script} rows={6} onFocus={(e) => e.target.select()} />
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  )
}

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

      {canEdit && <WidgetSettings />}

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
