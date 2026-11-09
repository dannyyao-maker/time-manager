-- =============================================================
-- 0007：iPhone 主畫面小工具（2026-11-09 決定）
-- 在 Supabase 後台 SQL Editor 執行一次（在 0001～0006 之後）。
-- 這個檔案不含任何 Email 或金鑰。
--
-- 小工具（Scriptable App）沒辦法用 Google 登入，所以改用「小工具密碼」：
--   1. 在網站「設定 → 手機小工具」按「產生密碼」（create_widget_token）
--      → 資料庫只存密碼的雜湊（hash，一種單向轉換，拿到也還原不回密碼）
--   2. 小工具帶著密碼呼叫 widget_week()，拿到「這週的我的行事曆」
--      ＝ 自己的個人行程＋約會＋自己的待辦（跟網站「我的」一樣），只能讀、不能改
--   3. 重新產生密碼，舊的就失效；也可以按「停用」
-- =============================================================

create table public.widget_tokens (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.widget_tokens is '手機小工具的密碼（只存雜湊）；只能透過下面的函式使用';

-- 任何人都不能直接讀寫這張表（只能透過函式）
alter table public.widget_tokens enable row level security;
revoke all on table public.widget_tokens from anon, authenticated;

-- 產生新密碼（舊的立刻失效）；密碼只在這一次回傳，之後查不到
create function public.create_widget_token()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t text;
begin
  if auth.uid() is null or not public.can_edit() then
    raise exception '只有可以編輯的成員能產生小工具密碼';
  end if;
  t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.widget_tokens (user_id, token_hash)
  values (auth.uid(), encode(sha256(convert_to(t, 'UTF8')), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now();
  return t;
end;
$$;

-- 停用小工具（刪掉密碼）
create function public.revoke_widget_token()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.widget_tokens where user_id = auth.uid();
$$;

-- 有沒有設定過小工具密碼（設定頁用來顯示狀態）
create function public.has_widget_token()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.widget_tokens where user_id = auth.uid());
$$;

-- 小工具讀資料：p_from 是那週的任一天（沒給就是今天，台灣時間）；回傳週日到週六每天的項目
create function public.widget_week(p_token text, p_from date default null)
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
           v.is_done, v.is_task, v.category_id, v.calendar
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
           s.is_task, s.category_id, s.calendar
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
         case when occ.calendar = 'shared' then '#9B7BD8'
              else coalesce(c.color, p.color, '#A39A92') end,
         occ.is_task,
         occ.is_done,
         occ.start_time is null
  from occ
  left join public.categories c on c.id = occ.category_id
  left join public.categories p on p.id = c.parent_id
  cross join generate_series(greatest(occ.start_date, wk_start)::timestamp,
                             least(occ.end_date, wk_end)::timestamp, interval '1 day') d
  order by 1, 8 desc, 3 nulls first, 2;
end;
$$;

revoke all on function public.create_widget_token() from public, anon;
revoke all on function public.revoke_widget_token() from public, anon;
revoke all on function public.has_widget_token() from public, anon;
revoke all on function public.widget_week(text, date) from public;
grant execute on function public.create_widget_token() to authenticated;
grant execute on function public.revoke_widget_token() to authenticated;
grant execute on function public.has_widget_token() to authenticated;
-- 小工具沒有登入，所以要讓 anon 呼叫；沒有正確密碼就什麼都拿不到
grant execute on function public.widget_week(text, date) to anon, authenticated;
