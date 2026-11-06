// 資料型別：對應 supabase/migrations/0001_schema.sql 的欄位

export type Category = {
  id: string
  parent_id: string | null
  name: string
  color: string | null
  sort_order: number
  owner_id?: string // 誰的類別（兩人各自有自己的類別）
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
  calendar?: CalendarKind // 第二版：個人或共用；舊資料沒有就當作個人
  owner_id?: string // 誰建立的（個人行程的擁有者）
}

// personal = 個人行程（只有擁有者能改）；shared = 共用（兩人都能改、不分類）
export type CalendarKind = 'personal' | 'shared'

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
  repeat_freq?: RepeatFreq | null // 不給 = 不改
  repeat_until?: string | null
  calendar?: CalendarKind // 不給 = 不改（新增時預設個人）
}

// 重複項目的「單次覆寫」：對應 occurrence_overrides 表
// 覆寫欄位空白 = 沿用整串的設定
export type Override = {
  id: string
  item_id: string
  occurrence_date: string // 原本應該發生的那一天
  is_cancelled: boolean
  is_done: boolean
  title: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  note: string | null
  location: string | null
}

// 畫面上看到的「一次」：一般項目就是它自己；重複項目是依規則算出來的其中一次
export type Occurrence = Item & {
  key: string // 畫面用的唯一代號：一般項目 = id；重複項目 = id:原本日期
  occurrence_date: string | null // 重複項目的原本日期；一般項目為空白
  series: Item | null // 重複項目的整串設定；一般項目為空白
}
