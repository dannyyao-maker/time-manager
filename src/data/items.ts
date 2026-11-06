import { supabase } from '../lib/supabase'
import type { Item, ItemInput } from './types'

const COLUMNS =
  'id, title, start_date, end_date, start_time, end_time, is_done, category_id, note, location, repeat_freq, repeat_until, calendar'

// 讀取請用 occurrences.ts 的 listOccurrences（會展開重複項目）；這裡只負責寫入

export async function createItem(input: ItemInput): Promise<Item> {
  const { data, error } = await supabase.from('items').insert(input).select(COLUMNS).single()
  if (error) throw error
  return data as Item
}

export async function updateItem(id: string, input: ItemInput) {
  const { error } = await supabase.from('items').update(input).eq('id', id)
  if (error) throw error
}

// 勾選／取消完成：只改這一個欄位
export async function setItemDone(id: string, done: boolean) {
  const { error } = await supabase.from('items').update({ is_done: done }).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}
