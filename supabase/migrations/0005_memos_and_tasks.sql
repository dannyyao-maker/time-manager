-- =============================================================
-- 0005：備忘錄、待辦（2026-11-07 決定）
-- 在 Supabase 後台 SQL Editor 執行一次（在 0001～0004 之後）。
-- 這個檔案不含任何 Email 或金鑰。
--
-- 改了什麼：
--   1. items 多一個欄位 is_task：待辦（checkbox）＝ true
--      待辦在行事曆上看得到，但不算行程：不會擋住「可約」，對方的行事曆也看不到
--   2. 新資料表 memos（備忘錄）：只有自己看得到、改得到
--   3. schedule_memo()：把一筆備忘錄排到某一天
--      ＝ 在那天新增一個待辦，並刪掉這筆備忘錄（兩件事一次完成）
--   4. 現有的「繳費、加退選、論文資料繳交」設成待辦
-- =============================================================

-- 1. 待辦欄位
alter table public.items add column is_task boolean not null default false;
comment on column public.items.is_task is '待辦（checkbox）：不算行程，不影響可約，只有自己的行事曆看得到';

-- 2. 備忘錄
create table public.memos (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

comment on table public.memos is '備忘錄：只有自己看得到；決定好日期就排成待辦，這筆會刪掉';

create index memos_owner_idx on public.memos (owner_id, created_at);

alter table public.memos enable row level security;
revoke all on table public.memos from anon;

create policy "memos: 只能讀自己的"
  on public.memos for select
  to authenticated
  using (public.can_edit() and owner_id = auth.uid());

create policy "memos: 只能新增自己的"
  on public.memos for insert
  to authenticated
  with check (public.can_edit() and owner_id = auth.uid());

create policy "memos: 只能修改自己的"
  on public.memos for update
  to authenticated
  using (public.can_edit() and owner_id = auth.uid())
  with check (public.can_edit() and owner_id = auth.uid());

create policy "memos: 只能刪除自己的"
  on public.memos for delete
  to authenticated
  using (public.can_edit() and owner_id = auth.uid());

-- 3. 排到某天：新增待辦＋刪掉備忘錄（同一個交易，不會只做一半）
--    security invoker：用呼叫的人自己的權限執行，權限規則照樣檢查
create function public.schedule_memo(p_memo uuid, p_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.items (owner_id, title, start_date, end_date, is_task, calendar)
  select auth.uid(), m.text, p_date, p_date, true, 'personal'
  from public.memos m
  where m.id = p_memo and m.owner_id = auth.uid()
  returning id into new_id;

  if new_id is null then
    raise exception '找不到這筆備忘錄（可能已經排過或刪掉了）';
  end if;

  delete from public.memos where id = p_memo;
  return new_id;
end;
$$;

revoke all on function public.schedule_memo(uuid, date) from public, anon;
grant execute on function public.schedule_memo(uuid, date) to authenticated;

-- 4. 現有的待辦
update public.items
set is_task = true
where start_time is null
  and start_date = end_date
  and repeat_freq is null
  and title in ('繳費', '加退選', '論文資料繳交');

-- 確認結果：設成待辦的有哪些
select title as 已設成待辦, start_date as 日期 from public.items where is_task order by start_date;
