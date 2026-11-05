import { supabase } from '../lib/supabase'
import type { Item, ItemInput } from './types'

const COLUMNS =
  'id, title, start_date, end_date, start_time, end_time, is_done, category_id, note, location, repeat_freq, repeat_until'

// fromDate：只拿「結束日期在這天之後」的項目；不給就全部拿
export async function listItems(fromDate?: string): Promise<Item[]> {
  let query = supabase
    .from('items')
    .select(COLUMNS)
    .order('start_date')
    .order('start_time', { nullsFirst: true })
    .order('created_at')
  if (fromDate) query = query.gte('end_date', fromDate)
  const { data, error } = await query
  if (error) throw error
  return data as Item[]
}

// 和 [from, to] 這段日期有重疊的項目（給行事曆用；兩端都包含）
export async function listItemsInRange(from: string, to: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(COLUMNS)
    .lte('start_date', to)
    .gte('end_date', from)
    .order('start_date')
    .order('start_time', { nullsFirst: true })
  if (error) throw error
  return data as Item[]
}

export async function createItem(input: ItemInput): Promise<Item> {
  const { data, error } = await supabase.from('items').insert(input).select(COLUMNS).single()
  if (error) throw error
  return data as Item
}

export async function updateItem(id: string, input: ItemInput) {
  const { error } = await supabase.from('items').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}
