// 匯出備份：把所有資料下載成檔案（JSON 完整備份＋CSV 給 Excel 看）
import { supabase } from '../lib/supabase'
import type { Category, Item, Override } from './types'

export type Backup = {
  app: 'time-manager'
  version: 1
  exported_at: string
  categories: Category[]
  items: Item[]
  occurrence_overrides: Override[]
}

export async function fetchBackup(): Promise<Backup> {
  const [cats, items, ovs] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('items').select('*').order('start_date'),
    supabase.from('occurrence_overrides').select('*').order('occurrence_date'),
  ])
  for (const r of [cats, items, ovs]) if (r.error) throw r.error
  return {
    app: 'time-manager',
    version: 1,
    exported_at: new Date().toISOString(),
    categories: cats.data as Category[],
    items: items.data as Item[],
    occurrence_overrides: ovs.data as Override[],
  }
}

const REPEAT_LABEL: Record<string, string> = { daily: '每天', weekly: '每週', monthly: '每月' }

// CSV 的一格：有逗號、引號、換行就用引號包起來
function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function backupToCsv(b: Backup): string {
  const catName = new Map(b.categories.map((c) => [c.id, c.name]))
  const header = ['行事曆', '開始日期', '結束日期', '開始時間', '結束時間', '標題', '類別', '地點', '備註', '重複', '重複到', '已完成']
  const rows = b.items.map((i) => [
    i.calendar === 'shared' ? '共用' : '個人',
    i.start_date,
    i.end_date,
    i.start_time?.slice(0, 5) ?? '',
    i.end_time?.slice(0, 5) ?? '',
    i.title,
    i.calendar === 'shared' ? '' : i.category_id ? catName.get(i.category_id) ?? '' : '未分類',
    i.location,
    i.note,
    i.repeat_freq ? REPEAT_LABEL[i.repeat_freq] : '',
    i.repeat_until,
    i.repeat_freq ? '' : i.is_done ? '是' : '',
  ])
  // 開頭加 BOM，Excel 打開中文才不會變亂碼
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
