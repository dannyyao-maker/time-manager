// 資料型別：對應 supabase/migrations/0001_schema.sql 的欄位

export type Category = {
  id: string
  parent_id: string | null
  name: string
  color: string | null
  sort_order: number
}

export type RepeatFreq = 'daily' | 'weekly' | 'monthly'

export type Item = {
  id: string
  title: string
  start_date: string // YYYY-MM-DD
  end_date: string
  start_time: string | null // HH:MM:SS；空白 = 整天
  end_time: string | null
  is_done: boolean
  category_id: string | null // 空白 = 未分類
  note: string | null
  location: string | null
  repeat_freq: RepeatFreq | null
  repeat_until: string | null
}

// 表單送出的內容（id、重複規則另外處理）
export type ItemInput = {
  title: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  category_id: string | null
  note: string | null
  location: string | null
  is_done?: boolean // 不給 = 不改（新增時預設未完成）
}
