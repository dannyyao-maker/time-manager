import { useState } from 'react'
import { signInWithGoogle } from '../hooks/useAuth'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleLogin() {
    setBusy(true)
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
      setBusy(false)
    }
    // 成功時瀏覽器會跳到 Google 登入頁，不用做其他事
  }

  return (
    <main className="page center">
      <h1>Time Manager</h1>
      <p className="subtitle">行事曆＋每日待辦，一個入口管理時間</p>
      <button className="btn-primary" onClick={handleLogin} disabled={busy}>
        {busy ? '前往 Google…' : '用 Google 帳號登入'}
      </button>
      <p className="hint">這是私人網站，只有受邀的帳號能看到內容。</p>
      {error && <p className="error">登入失敗：{error}</p>}
    </main>
  )
}
