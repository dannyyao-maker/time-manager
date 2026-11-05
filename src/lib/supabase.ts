import { createClient } from '@supabase/supabase-js'

// 網址和公開金鑰從環境變數讀取（.env.local 或 Vercel 後台），不寫在程式碼裡。
// 公開金鑰設計上可以出現在網站裡；資料安全由資料庫的 RLS 權限規則負責。
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const missingEnv = !url || !key

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key')
