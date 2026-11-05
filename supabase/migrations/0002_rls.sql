-- =============================================================
-- 0002：權限規則（RLS，Row Level Security 列層級安全）
-- 在 0001 之後執行。對應 階段0規劃.md 第 3 節。
--
-- 原則：開啟 RLS 後預設「全部拒絕」，只開放下面明確寫出來的事。
--   - 讀取：members 名單裡的人（owner、viewer）
--   - 新增／修改／刪除：只有 owner，而且只能動自己的資料
--   - members 名單：只能讀到自己那一列；網站上沒有人能修改
--   - 沒登入的人（anon）：完全沒有權限
-- =============================================================

-- -------------------------------------------------------------
-- 小工具：查「目前登入的人」在名單上的角色
-- security definer：以建立者身分查 members，避免規則互相卡住
-- -------------------------------------------------------------
create function public.my_member_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.members m
  where lower(m.email) = lower(auth.jwt() ->> 'email')
$$;

create function public.is_member()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.my_member_role() is not null
$$;

create function public.can_edit()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.my_member_role() = 'owner', false)
$$;

revoke all on function public.my_member_role() from public, anon;
revoke all on function public.is_member()      from public, anon;
revoke all on function public.can_edit()       from public, anon;
grant execute on function public.my_member_role() to authenticated;
grant execute on function public.is_member()      to authenticated;
grant execute on function public.can_edit()       to authenticated;

-- -------------------------------------------------------------
-- 開啟 RLS，並拿掉「沒登入的人」對資料表的所有權限（多一層保險）
-- -------------------------------------------------------------
alter table public.members              enable row level security;
alter table public.categories           enable row level security;
alter table public.items                enable row level security;
alter table public.occurrence_overrides enable row level security;

revoke all on table public.members              from anon;
revoke all on table public.categories           from anon;
revoke all on table public.items                from anon;
revoke all on table public.occurrence_overrides from anon;

-- -------------------------------------------------------------
-- members：只能讀自己那一列（讓畫面知道你是 owner 還是 viewer）
-- 沒有新增／修改／刪除規則 = 網站上沒有人能改名單
-- -------------------------------------------------------------
create policy "members: 只能讀自己"
  on public.members for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- -------------------------------------------------------------
-- categories
-- -------------------------------------------------------------
create policy "categories: 成員可讀"
  on public.categories for select
  to authenticated
  using (public.is_member());

create policy "categories: owner 可新增自己的"
  on public.categories for insert
  to authenticated
  with check (public.can_edit() and owner_id = auth.uid());

create policy "categories: owner 可修改自己的"
  on public.categories for update
  to authenticated
  using (public.can_edit() and owner_id = auth.uid())
  with check (public.can_edit() and owner_id = auth.uid());

create policy "categories: owner 可刪除自己的"
  on public.categories for delete
  to authenticated
  using (public.can_edit() and owner_id = auth.uid());

-- -------------------------------------------------------------
-- items：另外檢查「選的類別也是自己的」
-- -------------------------------------------------------------
create policy "items: 成員可讀"
  on public.items for select
  to authenticated
  using (public.is_member());

create policy "items: owner 可新增自己的"
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

create policy "items: owner 可修改自己的"
  on public.items for update
  to authenticated
  using (public.can_edit() and owner_id = auth.uid())
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

create policy "items: owner 可刪除自己的"
  on public.items for delete
  to authenticated
  using (public.can_edit() and owner_id = auth.uid());

-- -------------------------------------------------------------
-- occurrence_overrides：依所屬項目的擁有者判斷
-- -------------------------------------------------------------
create policy "overrides: 成員可讀"
  on public.occurrence_overrides for select
  to authenticated
  using (public.is_member());

create policy "overrides: owner 可新增自己項目的"
  on public.occurrence_overrides for insert
  to authenticated
  with check (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  );

create policy "overrides: owner 可修改自己項目的"
  on public.occurrence_overrides for update
  to authenticated
  using (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  )
  with check (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  );

create policy "overrides: owner 可刪除自己項目的"
  on public.occurrence_overrides for delete
  to authenticated
  using (
    public.can_edit()
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.owner_id = auth.uid()
    )
  );
