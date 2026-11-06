import { supabase } from '../lib/supabase'
import type { Category } from './types'

// 類別只有一層（2026-11-06 決定）；parent_id 欄位保留，但一律是空白
export const UNCATEGORIZED_COLOR = '#A39A92'

// 10 個顏色標籤（參考 TimeTree 的做法）
export const PALETTE: { hex: string; name: string }[] = [
  { hex: '#34A86B', name: '翡翠綠' },
  { hex: '#2BA5B5', name: '湖水青' },
  { hex: '#3D8FE0', name: '天空藍' },
  { hex: '#9C7B6B', name: '奶茶棕' },
  { hex: '#3A3633', name: '墨黑' },
  { hex: '#E2534B', name: '蘋果紅' },
  { hex: '#E0577F', name: '玫瑰粉' },
  { hex: '#EE7F6A', name: '珊瑚橘' },
  { hex: '#EE9A2E', name: '亮橘' },
  { hex: '#9B7BD8', name: '柔紫' },
]

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, parent_id, name, color, sort_order, owner_id')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data as Category[]
}

export async function createCategory(input: { name: string; color: string; sort_order: number }): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...input, parent_id: null })
    .select('id, parent_id, name, color, sort_order, owner_id')
    .single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'sort_order'>>) {
  const { error } = await supabase.from('categories').update(patch).eq('id', id)
  if (error) throw error
}

// 刪除類別：資料庫會自動連同項目、單次覆寫一起刪（cascade）
export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// 刪除前先算：會一起刪掉幾筆項目
export async function countDeleteImpact(category: Category) {
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', category.id)
  if (error) throw error
  return { items: count ?? 0 }
}

// 只取第一層（還沒執行 0003 搬移前，舊的第二層會被藏起來）
export function topLevel(all: Category[]): Category[] {
  return all.filter((c) => !c.parent_id)
}

// 顏色：自己有就用自己的；舊的第二層沒設定就用上一層的；未分類是灰色
export function resolveColor(categoryId: string | null, all: Category[]): string {
  if (!categoryId) return UNCATEGORIZED_COLOR
  const cat = all.find((c) => c.id === categoryId)
  if (!cat) return UNCATEGORIZED_COLOR
  if (cat.color) return cat.color
  const parent = all.find((c) => c.id === cat.parent_id)
  return parent?.color ?? UNCATEGORIZED_COLOR
}

// 第二版：共用行事曆的三種標示（2026-11-07 決定）
//   點（我，藍色）、宛（女友，粉色）：對方的個人行程顯示成這個，代表那個人那天不行
//   約會（紫色）：「一起」的項目，兩人都能改
export const SHARED_COLOR = '#9B7BD8'
export const SHARED_LABEL = '約會'
export const OWNER_COLOR = '#3D8FE0'
export const EDITOR_COLOR = '#E0577F'

type Colorable = { category_id: string | null; calendar?: 'personal' | 'shared' }

// 項目的顏色：共用項目用共用色，個人行程看類別
export function itemColor(item: Colorable, all: Category[]): string {
  return item.calendar === 'shared' ? SHARED_COLOR : resolveColor(item.category_id, all)
}

export function itemLabel(item: Colorable, all: Category[]): string {
  return item.calendar === 'shared' ? SHARED_LABEL : categoryLabel(item.category_id, all)
}

export function categoryLabel(categoryId: string | null, all: Category[]): string {
  if (!categoryId) return '未分類'
  return all.find((c) => c.id === categoryId)?.name ?? '未分類'
}

// 初始類別（第一次使用時可以一鍵建立）：我用提案.md 的，女友用她自己的四個
export const STARTER_CATEGORIES = [
  '研所課程',
  'CG（政大管顧社）',
  'DA（政大數據分析社）',
  '論文',
  '約會',
  '生活',
  '其它重要',
]
export const PARTNER_STARTER_CATEGORIES = ['上班', '自媒體', '有約', '其它']

export async function createStarterCategories(names: string[] = STARTER_CATEGORIES) {
  for (const [i, name] of names.entries()) {
    await createCategory({ name, color: PALETTE[i % PALETTE.length].hex, sort_order: i })
  }
}
