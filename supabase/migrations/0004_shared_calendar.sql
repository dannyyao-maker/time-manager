-- =============================================================
-- 0004：第二版：個人／共用行事曆、女友也能編輯（2026-11-07 決定）
-- 在 Supabase 後台 SQL Editor 執行一次（在 0001～0003 之後）。
-- 這個檔案不含任何 Email 或金鑰。
--
-- 改了什麼：
--   1. 每筆項目多一個欄位 calendar：personal（個人）或 shared（共用）
--   2. 成員角色多一種 editor（女友）：可以編輯自己的個人行程和所有共用項目
--   3. 權限規則：
--      - 讀取：成員都能讀全部（看對方的個人行程時，畫面顯示成忙碌）
--      - 個人行程：只有擁有者能新增／修改／刪除
--      - 共用項目：owner 和 editor 都能新增／修改／刪除
--      - 共用項目沒有類別（統一用共用色）
--      - 項目的擁有者不能被改掉
--   4. 現有「約會」類別的項目搬到共用行事曆
-- =============================================================

-- 1. 新欄位
alter table public.items
  add column calendar text not null default 'personal'
  check (calendar in ('personal', 'shared'));

alter table public.items
  add constraint items_shared_no_category check (calendar = 'personal' or category_id is null);

comment on column public.items.calendar is 'personal = 個人行程（只有擁有者能改）；shared = 共用（兩人都能改）';

-- 2. 成員角色：owner（我）、editor（女友，可以編輯）、viewer（只能看）
alter table public.members drop constraint if exists members_role_check;
alter table public.members
  add constraint members_role_check check (role in ('owner', 'editor', 'viewer'));

create or replace function public.can_edit()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.my_member_role() in ('owner', 'editor'), false)
$$;

-- 項目的擁有者不能被改掉（例如有人想把共用項目改成自己的）
create function public.keep_item_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.owner_id := old.owner_id;
  return new;
end;
$$;

create trigger items_keep_owner
  before update on public.items
  for each row execute function public.keep_item_owner();

-- 3. 權限規則（items、occurrence_overrides 重新設定；categories 沿用 0002）
drop policy if exists "items: owner 可新增自己的" on public.items;
drop policy if exists "items: owner 可修改自己的" on public.items;
drop policy if exists "items: owner 可刪除自己的" on public.items;

create policy "items: 可新增自己的個人行程或共用項目"
  on public.items for insert
  to authenticated
  with check (
    public.can_edit()
    and owner_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.owner_id = auth.uid()
      )
    )
  );

create policy "items: 可修改自己的個人行程或共用項目"
  on public.items for update
  to authenticated
  using (public.can_edit() and (owner_id = auth.uid() or calendar = 'shared'))
  with check (
    public.can_edit()
    and (owner_id = auth.uid() or calendar = 'shared')
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        -- 個人行程的類別必須屬於這筆項目的擁有者（寫 items.owner_id，避免和 c.owner_id 混淆）
        where c.id = category_id and c.owner_id = items.owner_id
      )
    )
  );

create policy "items: 可刪除自己的個人行程或共用項目"
  on public.items for delete
  to authenticated
  using (public.can_edit() and (owner_id = auth.uid() or calendar = 'shared'));

drop policy if exists "overrides: owner 可新增自己項目的" on public.occurrence_overrides;
drop policy if exists "overrides: owner 可修改自己項目的" on public.occurrence_overrides;
drop policy if exists "overrides: owner 可刪除自己項目的" on public.occurrence_overrides;

create policy "overrides: 可新增可編輯項目的"
  on public.occurrence_overrides for insert
  to authenticated
  with check (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and (i.owner_id = auth.uid() or i.calendar = 'shared')
    )
  );

create policy "overrides: 可修改可編輯項目的"
  on public.occurrence_overrides for update
  to authenticated
  using (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and (i.owner_id = auth.uid() or i.calendar = 'shared')
    )
  )
  with check (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and (i.owner_id = auth.uid() or i.calendar = 'shared')
    )
  );

create policy "overrides: 可刪除可編輯項目的"
  on public.occurrence_overrides for delete
  to authenticated
  using (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and (i.owner_id = auth.uid() or i.calendar = 'shared')
    )
  );

-- 4. 現有「約會」類別的項目搬到共用（共用項目不分類）
update public.items i
set calendar = 'shared', category_id = null
from public.categories c
where i.category_id = c.id and c.name = '約會';

-- 確認結果
select calendar as 行事曆, count(*) as 筆數 from public.items group by 1 order by 1;
