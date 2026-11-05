import { signOut, type Role } from '../hooks/useAuth'

type Props = { displayName: string; role: Role }

const roleLabel: Record<Role, string> = {
  owner: '擁有者（可編輯）',
  viewer: '檢視者（只能看）',
}

export default function HomePage({ displayName, role }: Props) {
  return (
    <main className="page">
      <header className="topbar">
        <strong>Time Manager</strong>
        <button className="btn-secondary" onClick={() => signOut()}>
          登出
        </button>
      </header>
      <h1>歡迎，{displayName}</h1>
      <p className="subtitle">身分：{roleLabel[role]}</p>
      <p className="status">登入成功。行事曆和每日清單會在接下來的階段加入。</p>
    </main>
  )
}
