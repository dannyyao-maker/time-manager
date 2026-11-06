import { useState } from 'react'
import { signOut, type Role } from '../hooks/useAuth'
import CalendarPage from './CalendarPage'
import DailyPage from './DailyPage'
import ItemsPage from './ItemsPage'
import CategoriesPage from './CategoriesPage'

type Props = { displayName: string; role: Role }

type Tab = 'calendar' | 'daily' | 'items' | 'categories'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendar', label: '行事曆' },
  { id: 'daily', label: '每日清單' },
  { id: 'items', label: '項目列表' },
  { id: 'categories', label: '類別' },
]

const TAB_KEY = 'tm.tab'

// 記住上次停在哪一頁（只存在這台裝置的瀏覽器）
function loadTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    if (TABS.some((x) => x.id === t)) return t as Tab
  } catch {
    // 讀不到就用預設
  }
  return 'calendar'
}

// 登入後的主畫面：上方導覽列＋目前的頁面
export default function HomePage({ displayName, role }: Props) {
  const [tab, setTab] = useState<Tab>(loadTab)
  const canEdit = role === 'owner'

  function changeTab(t: Tab) {
    setTab(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      // 存不了也沒關係
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Time Manager</strong>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => changeTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="user">
          <span className="user-name">
            {displayName}
            {!canEdit && <span className="badge">只能看</span>}
          </span>
          <button className="btn-secondary btn-small" onClick={() => signOut()}>
            登出
          </button>
        </div>
      </header>

      <main className="content">
        {tab === 'calendar' && <CalendarPage canEdit={canEdit} />}
        {tab === 'daily' && <DailyPage canEdit={canEdit} />}
        {tab === 'items' && <ItemsPage canEdit={canEdit} />}
        {tab === 'categories' && <CategoriesPage canEdit={canEdit} />}
      </main>
    </div>
  )
}
