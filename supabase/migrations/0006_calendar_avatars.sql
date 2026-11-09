-- =============================================================
-- 0006：行事曆頭貼（2026-11-09 決定）
-- 在 Supabase 後台 SQL Editor 執行一次（在 0001～0005 之後）。
-- 這個檔案不含任何 Email 或金鑰。
--
-- 三個行事曆（我的／共用／對方的）切換鈕上的小圓圖：
--   key = 自己的 user id：自己的頭貼（自己的「我的」、對方的「點的／宛的」都用這張）
--   key = 'shared'：共用行事曆的頭貼，兩個人都能換
-- 圖片在手機上先縮成 160×160 的小 JPG 再存，所以直接存在資料庫（不用另外的檔案空間）。
-- =============================================================

create table public.calendar_avatars (
  key        text primary key
             check (key = 'shared' or key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  image      text not null
             check (image like 'data:image/%' and char_length(image) <= 200000),
  updated_at timestamptz not null default now()
);

comment on table public.calendar_avatars is '行事曆頭貼：key 是 user id 或 shared；image 是縮小過的圖片（data URL）';

alter table public.calendar_avatars enable row level security;
revoke all on table public.calendar_avatars from anon;

create policy "avatars: 成員可讀"
  on public.calendar_avatars for select
  to authenticated
  using (public.is_member());

create policy "avatars: 只能新增自己的或共用的"
  on public.calendar_avatars for insert
  to authenticated
  with check (public.can_edit() and (key = auth.uid()::text or key = 'shared'));

create policy "avatars: 只能修改自己的或共用的"
  on public.calendar_avatars for update
  to authenticated
  using (public.can_edit() and (key = auth.uid()::text or key = 'shared'))
  with check (public.can_edit() and (key = auth.uid()::text or key = 'shared'));

create policy "avatars: 只能刪除自己的或共用的"
  on public.calendar_avatars for delete
  to authenticated
  using (public.can_edit() and (key = auth.uid()::text or key = 'shared'));

create trigger calendar_avatars_updated_at
  before update on public.calendar_avatars
  for each row execute function public.set_updated_at();
