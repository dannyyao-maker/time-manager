import { describe, expect, it } from 'vitest'
import { backupToCsv, type Backup } from './export'

const backup: Backup = {
  app: 'time-manager',
  version: 1,
  exported_at: '2026-11-06T00:00:00Z',
  categories: [{ id: 'c1', parent_id: null, name: '研所課程', color: '#E2534B', sort_order: 0 }],
  items: [
    {
      id: 'i1', title: '日文上課', start_date: '2026-10-13', end_date: '2026-10-13', start_time: '10:20:00', end_time: '12:10:00',
      is_done: false, category_id: 'c1', note: null, location: '台大', repeat_freq: 'weekly', repeat_until: '2026-12-15',
    },
    {
      id: 'i2', title: '寫報告, 第一章', start_date: '2026-11-06', end_date: '2026-11-06', start_time: null, end_time: null,
      is_done: true, category_id: null, note: '他說："先寫大綱"\n再寫內文', location: null, repeat_freq: null, repeat_until: null,
    },
  ],
  occurrence_overrides: [],
  memos: [],
}

describe('backupToCsv：給 Excel 看的 CSV', () => {
  const csv = backupToCsv(backup)
  const lines = csv.split('\r\n')

  it('開頭有 BOM，Excel 才不會亂碼', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('第一列是中文欄名', () => {
    expect(lines[0].slice(1)).toBe('行事曆,開始日期,結束日期,開始時間,結束時間,標題,類別,地點,備註,重複,重複到,已完成')
  })

  it('重複項目：寫出規則和類別名稱', () => {
    expect(lines[1]).toBe('個人,2026-10-13,2026-10-13,10:20,12:10,日文上課,研所課程,台大,,每週,2026-12-15,')
  })

  it('逗號、引號、換行會被正確包起來；沒分類寫「未分類」', () => {
    expect(csv).toContain('"寫報告, 第一章",未分類,,"他說：""先寫大綱""\n再寫內文",,,是')
  })
})
