import { useState } from 'react'
import { signOut, type Role } from '../hooks/useAuth'
import CalendarPage from './CalendarPage'
import DailyPage from './DailyPage'
import MemoPage from './MemoPage'
import ItemsPage from './ItemsPage'
import SettingsPage from './SettingsPage'
import TabIcon from '../components/TabIcon'
import Tour from '../components/tour/Tour'

type Props = { displayName: string; role: Role }

// 下方分頁維持 4 個；類別和備份移到右上角的「設定」
type Tab = 'calendar' | 'daily' | 'memo' | 'items' | 'settings'

const TABS: { id: Exclude<Tab, 'settings'>; label: string }[] = [
  { id: 'calendar', label: '行事曆' },
  { id: 'daily', label: '每日清單' },
  { id: 'memo', label: '備忘錄' },
  { id: 'items', label: '列表' },
]

const TAB_KEY = 'tm.tab'
const TOUR_KEY = 'tm.tourSeen' // 這台裝置看過導覽了嗎

function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return true // 讀不到（例如無痕模式）就不要每次都跳出來
  }
}
const ALL_TABS: Tab[] = ['calendar', 'daily', 'memo', 'items', 'settings']

// 記住上次停在哪一頁（只存在這台裝置的瀏覽器）
function loadTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    if (t && (ALL_TABS as string[]).includes(t)) return t as Tab
  } catch {
    // 讀不到就用預設
  }
  return 'calendar'
}

// 登入後的主畫面：上方導覽列＋目前的頁面
export default function HomePage({ displayName, role }: Props) {
  // owner（我）和 editor（女友）都能編輯；viewer 只能看
  const canEdit = role === 'owner' || role === 'editor'
  // 只能看的人只有行事曆一頁（畫面乾淨）
  const [tab, setTab] = useState<Tab>(() => (canEdit ? loadTab() : 'calendar'))
  // 第一次在這台裝置登入：自動播放導覽；之後可以在「設定 → 看導覽」重看
  const [showTour, setShowTour] = useState(() => !tourSeen())

  function closeTour() {
    setShowTour(false)
    try {
      localStorage.setItem(TOUR_KEY, '1')
    } catch {
      // 存不了也沒關係
    }
  }

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
        {canEdit ? (
          <nav className="tabs" aria-label="頁面">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'tab active' : 'tab'}
                onClick={() => changeTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <TabIcon name={t.id} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        ) : (
          <div className="tabs-spacer" />
        )}
        <div className="user">
          <span className="user-name">
            {displayName}
            {!canEdit && <span className="badge">只能看</span>}
          </span>
          {canEdit && (
            <button
              className={tab === 'settings' ? 'btn-icon settings-btn active' : 'btn-icon settings-btn'}
              onClick={() => changeTab('settings')}
              aria-label="設定（類別、備份）"
              title="設定（類別、備份）"
            >
              <TabIcon name="settings" />
            </button>
          )}
          <button className="btn-secondary btn-small" onClick={() => signOut()}>
            登出
          </button>
        </div>
      </header>

      <main className={canEdit ? 'content' : 'content viewer'}>
        {tab === 'calendar' && <CalendarPage canEdit={canEdit} onOpenSettings={() => changeTab('settings')} />}
        {tab === 'daily' && <DailyPage canEdit={canEdit} />}
        {tab === 'memo' && <MemoPage canEdit={canEdit} />}
        {tab === 'items' && <ItemsPage canEdit={canEdit} />}
        {tab === 'settings' && <SettingsPage canEdit={canEdit} isPartner={role === 'editor'} onShowTour={() => setShowTour(true)} />}
      </main>

      {showTour && <Tour onClose={closeTour} />}
    </div>
  )
}
