// 行事曆頭貼：key 是 user id（自己的頭貼）或 'shared'（共用行事曆）
import { supabase } from '../lib/supabase'

export const SHARED_AVATAR = 'shared'

export type Avatars = Record<string, string>

export async function listAvatars(): Promise<Avatars> {
  const { data, error } = await supabase.from('calendar_avatars').select('key, image')
  // 還沒執行 0006（資料表不存在）時，當作沒有頭貼，畫面照常顯示
  if (error) return {}
  return Object.fromEntries((data as { key: string; image: string }[]).map((r) => [r.key, r.image]))
}

export async function saveAvatar(key: string, image: string) {
  const { error } = await supabase.from('calendar_avatars').upsert({ key, image })
  if (error) throw error
}

export async function removeAvatar(key: string) {
  const { error } = await supabase.from('calendar_avatars').delete().eq('key', key)
  if (error) throw error
}

// 選好的照片：裁成正方形、縮成 160×160 的 JPG（大約 10 KB）
export async function fileToAvatar(file: File, size = 160): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('這張圖片打不開，請換一張'))
      el.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
