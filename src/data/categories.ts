import { supabase } from '../lib/supabase'
import type { Category } from './types'

export const UNCATEGORIZED_COLOR = '#9CA3AF'

// 新類別的預設顏色，依序輪流使用
export const PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, parent_id, name, color, sort_order')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data as Category[]
}

export async function createCategory(input: {
  name: string
  parent_id: string | null
  color: string | null
  sort_order: number
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(input)
    .select('id, parent_id, name, color, sort_order')
    .single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color' | 'sort_order'>>,
) {
  const { error } = await supabase.from('categories').update(patch).eq('id', id)
  if (error) throw error
}

// 刪除類別：資料庫會自動連同子類別、項目、單次覆寫一起刪（cascade）
export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// 刪除前先算：會一起刪掉幾個子類別、幾筆項目
export async function countDeleteImpact(category: Category, all: Category[]) {
  const children = all.filter((c) => c.parent_id === category.id)
  const ids = [category.id, ...children.map((c) => c.id)]
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .in('category_id', ids)
  if (error) throw error
  return { children: children.length, items: count ?? 0 }
}

// 顏色：自己有就用自己的；第二層沒設定就用第一層的；未分類是灰色
export function resolveColor(categoryId: string | null, all: Category[]): string {
  if (!categoryId) return UNCATEGORIZED_COLOR
  const cat = all.find((c) => c.id === categoryId)
  if (!cat) return UNCATEGORIZED_COLOR
  if (cat.color) return cat.color
  const parent = all.find((c) => c.id === cat.parent_id)
  return parent?.color ?? UNCATEGORIZED_COLOR
}

// 顯示名稱：「研所課程 › 日文」
export function categoryLabel(categoryId: string | null, all: Category[]): string {
  if (!categoryId) return '未分類'
  const cat = all.find((c) => c.id === categoryId)
  if (!cat) return '未分類'
  const parent = all.find((c) => c.id === cat.parent_id)
  return parent ? `${parent.name} › ${cat.name}` : cat.name
}

// 依「第一層 → 它的第二層」排好，給選單和列表用
export function sortAsTree(all: Category[]) {
  const tops = all.filter((c) => !c.parent_id)
  return tops.map((top) => ({
    top,
    children: all.filter((c) => c.parent_id === top.id),
  }))
}

// 提案.md 裡的初始類別（第一次使用時可以一鍵建立）
export const STARTER_CATEGORIES: { name: string; children: string[] }[] = [
  { name: '研所課程', children: ['日文', 'R', '國金'] },
  { name: 'CG（政大管顧社）', children: [] },
  { name: 'DA（政大數據分析社）', children: [] },
  { name: '論文', children: [] },
  { name: '約會', children: [] },
  { name: '生活', children: ['吃飯', '健身', '家', '出遊'] },
  { name: '其它重要', children: ['coffee chat', '面試'] },
]

export async function createStarterCategories() {
  for (const [i, group] of STARTER_CATEGORIES.entries()) {
    const top = await createCategory({
      name: group.name,
      parent_id: null,
      color: PALETTE[i % PALETTE.length],
      sort_order: i,
    })
    for (const [j, childName] of group.children.entries()) {
      await createCategory({ name: childName, parent_id: top.id, color: null, sort_order: j })
    }
  }
}
