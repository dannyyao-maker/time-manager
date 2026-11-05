import { missingEnv } from './lib/supabase'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import NoAccessPage from './pages/NoAccessPage'
import HomePage from './pages/HomePage'

export default function App() {
  const auth = useAuth()

  if (missingEnv) {
    return (
      <main className="page center">
        <h1>設定不完整</h1>
        <p className="error">
          找不到 VITE_SUPABASE_URL 或 VITE_SUPABASE_PUBLISHABLE_KEY。請檢查 .env.local（本機）或 Vercel 的環境變數。
        </p>
      </main>
    )
  }

  switch (auth.status) {
    case 'loading':
      return <main className="page center"><p className="subtitle">載入中…</p></main>
    case 'signed-out':
      return <LoginPage />
    case 'no-access':
      return <NoAccessPage />
    case 'member':
      return <HomePage displayName={auth.displayName} role={auth.role} />
    case 'error':
      return (
        <main className="page center">
          <h1>發生錯誤</h1>
          <p className="error">{auth.message}</p>
        </main>
      )
  }
}
