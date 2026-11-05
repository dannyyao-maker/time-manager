import { signOut } from '../hooks/useAuth'

export default function NoAccessPage() {
  return (
    <main className="page center">
      <h1>沒有權限</h1>
      <p className="subtitle">這個 Google 帳號不在成員名單上，看不到任何內容。</p>
      <button className="btn-secondary" onClick={() => signOut()}>
        登出，換一個帳號
      </button>
    </main>
  )
}
