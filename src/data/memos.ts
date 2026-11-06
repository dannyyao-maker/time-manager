// 備忘錄：只有自己看得到；決定好日期就排成那天的待辦，這筆會刪掉
import { supabase } from '../lib/supabase'

export type Memo = { id: string; text: string; created_at: string }

export async function listMemos(): Promise<Memo[]> {
  const { data, error } = await supabase.from('memos').select('id, text, created_at').order('created_at')
  if (error) throw error
  return data as Memo[]
}

export async function createMemo(text: string): Promise<Memo> {
  const { data, error } = await supabase.from('memos').insert({ text }).select('id, text, created_at').single()
  if (error) throw error
  return data as Memo
}

export async function deleteMemo(id: string) {
  const { error } = await supabase.from('memos').delete().eq('id', id)
  if (error) throw error
}

// 排到某天：資料庫一次完成「新增那天的待辦」和「刪掉這筆備忘錄」
export async function scheduleMemo(id: string, date: string): Promise<string> {
  const { data, error } = await supabase.rpc('schedule_memo', { p_memo: id, p_date: date })
  if (error) throw error
  return data as string
}
