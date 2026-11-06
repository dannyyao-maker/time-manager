-- =============================================================
-- 找出可能重複的項目（只讀取，不會修改任何資料）
-- 判斷方式：同一個人、同一個開始時間，而且會落在同一天
--   - 兩筆都是單次：同一天
--   - 一筆單次＋一筆每週重複：單次那天剛好是重複的星期幾、而且在重複期間內
--   - 兩筆都是每週重複：同一個星期幾、期間有重疊
-- 在 Supabase SQL Editor 執行，把結果截圖給 Claude。
-- =============================================================

with i as (
  select id, owner_id, title, start_date, start_time, repeat_freq,
         coalesce(repeat_until, '9999-12-31'::date) as until_date,
         extract(dow from start_date) as dow
  from public.items
  where start_time is not null
)
select
  a.title as 項目一,
  case when a.repeat_freq is null then to_char(a.start_date, 'MM/DD') else '每週' || (array['日','一','二','三','四','五','六'])[a.dow + 1] || '（' || to_char(a.start_date, 'MM/DD') || ' 起）' end as 項目一的日期,
  b.title as 項目二,
  case when b.repeat_freq is null then to_char(b.start_date, 'MM/DD') else '每週' || (array['日','一','二','三','四','五','六'])[b.dow + 1] || '（' || to_char(b.start_date, 'MM/DD') || ' 起）' end as 項目二的日期,
  to_char(a.start_time, 'HH24:MI') as 開始時間,
  a.id as 項目一_id,
  b.id as 項目二_id
from i a
join i b
  on a.id < b.id
 and a.owner_id = b.owner_id
 and a.start_time = b.start_time
where
  (a.repeat_freq is null and b.repeat_freq is null and a.start_date = b.start_date)
  or (a.repeat_freq = 'weekly' and b.repeat_freq is null and b.dow = a.dow and b.start_date between a.start_date and a.until_date)
  or (b.repeat_freq = 'weekly' and a.repeat_freq is null and a.dow = b.dow and a.start_date between b.start_date and b.until_date)
  or (a.repeat_freq = 'weekly' and b.repeat_freq = 'weekly' and a.dow = b.dow
      and a.start_date <= b.until_date and b.start_date <= a.until_date)
order by a.start_date, a.start_time;
