// 畫面用的資料入口：拿某段日期的「每一次」，以及對某一次做的動作
import { supabase } from '../lib/supabase'
import { buildOverridePatch, expandItems } from '../lib/recurrence'
import type { Item, ItemInput, Occurrence, Override } from './types'
import { setItemDone } from './items'

const ITEM_COLUMNS =
  'id, title, start_date, end_date, start_time, end_time, is_done, category_id, note, location, repeat_freq, repeat_until, calendar'
const OVERRIDE_COLUMNS =
  'id, item_id, occurrence_date, is_cancelled, is_done, title, start_date, end_date, start_time, end_time, note, location'

// [from, to] 這段日期要顯示的每一次（兩端都包含）
export async function listOccurrences(from: string, to: string): Promise<Occurrence[]> {
  const [single, repeating] = await Promise.all([
    supabase
      .from('items')
      .select(ITEM_COLUMNS)
      .is('repeat_freq', null)
      .lte('start_date', to)
      .gte('end_date', from),
    supabase
      .from('items')
      .select(ITEM_COLUMNS)
      .not('repeat_freq', 'is', null)
      .lte('start_date', to)
      .or(`repeat_until.is.null,repeat_until.gte.${from}`),
  ])
  if (single.error) throw single.error
  if (repeating.error) throw repeating.error

  const series = repeating.data as Item[]
  let overrides: Override[] = []
  if (series.length > 0) {
    const { data, error } = await supabase
      .from('occurrence_overrides')
      .select(OVERRIDE_COLUMNS)
      .in(
        'item_id',
        series.map((s) => s.id),
      )
    if (error) throw error
    overrides = data as Override[]
  }

  return expandItems([...(single.data as Item[]), ...series], overrides, from, to)
}

// 寫入（或更新）某一次的覆寫
async function upsertOverride(itemId: string, occurrenceDate: string, fields: Partial<Override>) {
  const { error } = await supabase
    .from('occurrence_overrides')
    .upsert({ item_id: itemId, occurrence_date: occurrenceDate, ...fields }, { onConflict: 'item_id,occurrence_date' })
  if (error) throw error
}

// 勾選完成：一般項目改它自己；重複項目只記這一次
export async function setOccurrenceDone(occ: Occurrence, done: boolean) {
  if (occ.series && occ.occurrence_date) {
    await upsertOverride(occ.series.id, occ.occurrence_date, { is_done: done })
  } else {
    await setItemDone(occ.id, done)
  }
}

// 只改這一次
export async function saveThisOccurrence(occ: Occurrence, input: ItemInput) {
  if (!occ.series || !occ.occurrence_date) throw new Error('這不是重複項目')
  const patch = buildOverridePatch(occ.series, occ.occurrence_date, input)
  await upsertOverride(occ.series.id, occ.occurrence_date, { ...patch, is_cancelled: false })
}

// 刪除這一次（例如停課）：其他次不受影響
export async function cancelThisOccurrence(occ: Occurrence) {
  if (!occ.series || !occ.occurrence_date) throw new Error('這不是重複項目')
  await upsertOverride(occ.series.id, occ.occurrence_date, { is_cancelled: true })
}

// 把畫面上的一次轉回表單格式（給「只改這一次」用）
export function occurrenceToInput(occ: Occurrence): ItemInput {
  return {
    title: occ.title,
    start_date: occ.start_date,
    end_date: occ.end_date,
    start_time: occ.start_time,
    end_time: occ.end_time,
    category_id: occ.category_id,
    note: occ.note,
    location: occ.location,
    is_done: occ.is_done,
  }
}
