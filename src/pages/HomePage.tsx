import { useState } from 'react'
import { signOut, type Role } from '../hooks/useAuth'
import CalendarPage from './CalendarPage'
import ItemsPage from './ItemsPage'
import CategoriesPage from './CategoriesPage'

type Props = { displayName: string; role: Role }

type Tab = 'calendar' | 'items' | 'categories'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendar', label: '行事曆' },
  { id: 'items', label: '項目列表' },
  { id: 'categories', label: '類別' },
]

// 登入後的主畫面：上方導覽列＋目前的頁面
export default function HomePage({ displayName, role }: Props) {
  const [tab, setTab] = useState<Tab>('calendar')
  const canEdit = role === 'owner'

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Time Manager</strong>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
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
        {tab === 'items' && <ItemsPage canEdit={canEdit} />}
        {tab === 'categories' && <CategoriesPage canEdit={canEdit} />}
      </main>
    </div>
  )
}
