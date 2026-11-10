-- =============================================================
-- 0008：紀念日、待辦排在行程下面（2026-11-10 決定）
-- 在 Supabase 後台 SQL Editor 執行一次（在 0001～0007 之後）。
-- 這個檔案不含任何 Email、金鑰或日期資料。
--
-- 改了什麼：
--   1. items 多一個欄位 is_special：紀念日／節日（例如在一起 100 天、生日）
--      紀念日顯示在當天最上面，不算行程、不影響「可約」
--   2. 小工具 widget_week() 的順序：紀念日 → 整天 → 有時間的 → 待辦（跟網站一樣）
-- =============================================================

alter table public.items add column is_special boolean not null default false;
comment on column public.items.is_special is '紀念日／節日：顯示在當天最上面，不影響可約';

-- 小工具讀資料：p_from 是那週的任一天（沒給就是今天，台灣時間）；回傳週日到週六每天的項目
create or replace function public.widget_week(p_token text, p_from date default null)
returns table (
  day        date,
  title      text,
  start_time text,
  end_time   text,
  color      text,
  is_task    boolean,
  is_done    boolean,
  all_day    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid      uuid;
  anchor   date := coalesce(p_from, (now() at time zone 'Asia/Taipei')::date);
  wk_start date;
  wk_end   date;
begin
  if p_token is null or char_length(p_token) < 32 then
    raise exception '小工具密碼不正確';
  end if;

  -- 密碼對得上，而且這個人還在成員名單裡、可以編輯
  select w.user_id into uid
  from public.widget_tokens w
  join auth.users u on u.id = w.user_id
  join public.members m on lower(m.email) = lower(u.email) and m.role in ('owner', 'editor')
  where w.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  if uid is null then
    raise exception '小工具密碼不正確或已停用';
  end if;

  wk_start := anchor - extract(dow from anchor)::int; -- 週日
  wk_end := wk_start + 6;

  return query
  with visible as (
    -- 跟網站「我的」一樣：自己的個人行程、約會；待辦只看自己的
    select i.*
    from public.items i
    where case
            when i.is_task and i.start_time is null then i.owner_id = uid
            else i.owner_id = uid or i.calendar = 'shared'
          end
  ),
  singles as (
    select v.id, v.title, v.start_date, v.end_date, v.start_time, v.end_time,
           v.is_done, v.is_task, v.category_id, v.calendar, v.is_special
    from visible v
    where v.repeat_freq is null and v.start_date <= wk_end and v.end_date >= wk_start
  ),
  series as (
    select v.*, (v.end_date - v.start_date) as dur
    from visible v
    where v.repeat_freq is not null and v.start_date <= wk_end + 31
      and (v.repeat_until is null or v.repeat_until >= wk_start - 31)
  ),
  -- 每一串「原本」會發生的日期（視窗前後多抓 31 天：單次被移到別天的也找得到）
  originals as (
    select s.id as item_id, g::date as orig
    from series s,
         generate_series(s.start_date::timestamp,
                         least(coalesce(s.repeat_until, wk_end + 31), wk_end + 31)::timestamp,
                         case s.repeat_freq when 'daily' then interval '1 day' else interval '7 days' end) g
    where s.repeat_freq in ('daily', 'weekly') and g::date >= wk_start - s.dur - 31
    union all
    -- 每月：同一天；那個月沒有這一天（例如 31 號）就跳過
    select s.id, (s.start_date + make_interval(months => k))::date
    from series s,
         generate_series(0, ((extract(year from wk_end) - extract(year from s.start_date)) * 12
                             + extract(month from wk_end) - extract(month from s.start_date) + 2)::int) k
    where s.repeat_freq = 'monthly'
      and extract(day from (s.start_date + make_interval(months => k))) = extract(day from s.start_date)
      and (s.start_date + make_interval(months => k))::date <= least(coalesce(s.repeat_until, wk_end + 31), wk_end + 31)
      and (s.start_date + make_interval(months => k))::date >= wk_start - s.dur - 31
  ),
  repeated as (
    select s.id,
           coalesce(o.title, s.title) as title,
           coalesce(o.start_date, x.orig) as start_date,
           coalesce(o.end_date, coalesce(o.start_date, x.orig) + s.dur) as end_date,
           coalesce(o.start_time, s.start_time) as start_time,
           coalesce(o.end_time, s.end_time) as end_time,
           coalesce(o.is_done, false) as is_done,
           s.is_task, s.category_id, s.calendar, s.is_special
    from originals x
    join series s on s.id = x.item_id
    left join public.occurrence_overrides o on o.item_id = x.item_id and o.occurrence_date = x.orig
    where not coalesce(o.is_cancelled, false)
  ),
  occ as (
    select * from singles
    union all
    select * from repeated where repeated.start_date <= wk_end and repeated.end_date >= wk_start
  )
  select d::date,
         occ.title,
         to_char(occ.start_time, 'HH24:MI'),
         to_char(occ.end_time, 'HH24:MI'),
         case when occ.is_special then '#EE7F6A'
              when occ.calendar = 'shared' then '#9B7BD8'
              else coalesce(c.color, p.color, '#A39A92') end,
         occ.is_task,
         occ.is_done,
         occ.start_time is null
  from occ
  left join public.categories c on c.id = occ.category_id
  left join public.categories p on p.id = c.parent_id
  cross join generate_series(greatest(occ.start_date, wk_start)::timestamp,
                             least(occ.end_date, wk_end)::timestamp, interval '1 day') d
  -- 紀念日最上面、待辦最下面，中間是整天、再照時間
  order by 1, occ.is_special desc, 6, 8 desc, 3 nulls first, 2;
end;
$$;
