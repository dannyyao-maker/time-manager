// 目前登入的人是誰（登入時由 useAuth 設定）
// 用來判斷一筆項目是「我的」還是「對方的」
let currentUserId: string | null = null

export function setCurrentUserId(id: string | null) {
  currentUserId = id
}

export function getCurrentUserId(): string | null {
  return currentUserId
}
