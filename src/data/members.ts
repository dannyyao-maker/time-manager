// 成員名冊：每筆項目是誰的（共用行事曆顯示「點」或「宛」）
// 資料庫的 member_directory() 只回傳 id、名字、角色，不含 Email
import { supabase } from '../lib/supabase'
import { EDITOR_COLOR, OWNER_COLOR } from './categories'

export type Member = { user_id: string; display_name: string | null; role: 'owner' | 'editor' | 'viewer' }

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase.rpc('member_directory')
  if (error) throw error
  return (data ?? []) as Member[]
}

// 每個人在共用行事曆上的名字和顏色：我（owner）藍色、女友（editor）粉色
export function memberBadge(m: Member | undefined): { label: string; color: string } {
  if (!m) return { label: '忙碌', color: '#8C837B' }
  return {
    label: m.display_name || (m.role === 'owner' ? '點' : '宛'),
    color: m.role === 'owner' ? OWNER_COLOR : EDITOR_COLOR,
  }
}
