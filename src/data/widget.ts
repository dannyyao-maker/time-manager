// 手機小工具的密碼：產生、停用、查狀態（資料庫只存密碼的雜湊）
import { supabase } from '../lib/supabase'

// null = 資料庫還沒更新（還沒執行 0007）
export async function hasWidgetToken(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('has_widget_token')
  if (error) return null
  return data as boolean
}

export async function createWidgetToken(): Promise<string> {
  const { data, error } = await supabase.rpc('create_widget_token')
  if (error) throw error
  return data as string
}

export async function revokeWidgetToken() {
  const { error } = await supabase.rpc('revoke_widget_token')
  if (error) throw error
}
