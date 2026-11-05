-- =============================================================
-- 0001：建立資料表
-- 在 Supabase 後台 SQL Editor 執行。對應 階段0規劃.md 第 2 節。
-- 這個檔案不含任何 Email 或金鑰。
-- =============================================================

-- -------------------------------------------------------------
-- members：成員名單（誰能看資料、是什麼角色）
-- 名單內容只在 Supabase 後台手動輸入，不寫在程式碼裡。
-- -------------------------------------------------------------
create table public.members (
  email        text primary key,
  role         text not null check (role in ('owner', 'viewer')),
  display_name text,
  created_at   timestamptz not null default now()
);

comment on table public.members is '成員名單：owner 可編輯，viewer 只能讀';

-- -------------------------------------------------------------
-- categories：類別（最多兩層）
-- parent_id 空白 = 第一層；有值 = 第二層
-- 刪除第一層時，第二層一起刪（on delete cascade）
-- -------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id  uuid references public.categories (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 50),
  color      text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.categories is '類別，最多兩層；color 空白時沿用上一層';

-- 只允許兩層，且上下層必須屬於同一個人
create function public.check_category_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception '類別不能放在自己底下';
  end if;

  if exists (
    select 1 from public.categories
    where id = new.parent_id and parent_id is not null
  ) then
    raise exception '類別最多只能兩層';
  end if;

  if exists (
    select 1 from public.categories where parent_id = new.id
  ) then
    raise exception '這個類別底下已經有子類別，不能再放到別的類別底下';
  end if;

  if not exists (
    select 1 from public.categories
    where id = new.parent_id and owner_id = new.owner_id
  ) then
    raise exception '上一層類別不存在，或不屬於同一個人';
  end if;

  return new;
end;
$$;

create trigger categories_check_depth
  before insert or update of parent_id, owner_id on public.categories
  for each row execute function public.check_category_depth();

-- -------------------------------------------------------------
-- items：項目（行程和待辦共用）
-- start_time 空白 = 整天／當天待辦
-- repeat_freq 空白 = 不重複
-- 刪除類別時，項目一起刪（on delete cascade）
-- -------------------------------------------------------------
create table public.items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  start_date   date not null,
  end_date     date not null,
  start_time   time,
  end_time     time,
  is_done      boolean not null default false,
  note         text,
  location     text,
  repeat_freq  text check (repeat_freq in ('daily', 'weekly', 'monthly')),
  repeat_until date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint items_end_after_start
    check (end_date >= start_date),
  constraint items_end_time_needs_start_time
    check (end_time is null or start_time is not null),
  constraint items_time_order
    check (start_time is null or end_time is null or end_date > start_date or end_time >= start_time),
  constraint items_until_needs_repeat
    check (repeat_until is null or repeat_freq is not null),
  constraint items_until_after_start
    check (repeat_until is null or repeat_until >= start_date)
);

comment on table public.items is '項目：行程和待辦共用。重複項目只存一筆，畫面依規則展開';

-- -------------------------------------------------------------
-- occurrence_overrides：重複項目的「單次覆寫」
-- 停課（is_cancelled）、只改這一次（覆寫欄位）、這一次勾完成（is_done）
-- occurrence_date = 原本應該發生的那一天
-- -------------------------------------------------------------
create table public.occurrence_overrides (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.items (id) on delete cascade,
  occurrence_date date not null,
  is_cancelled    boolean not null default false,
  is_done         boolean not null default false,
  title           text check (title is null or char_length(title) between 1 and 200),
  start_date      date,
  end_date        date,
  start_time      time,
  end_time        time,
  note            text,
  location        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint overrides_one_per_occurrence unique (item_id, occurrence_date)
);

comment on table public.occurrence_overrides is '重複項目的單次覆寫：停課、改這一次、這一次勾完成';

-- -------------------------------------------------------------
-- 自動更新 updated_at
-- -------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create trigger overrides_set_updated_at
  before update on public.occurrence_overrides
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 索引（index：讓資料庫查得更快的目錄）
-- -------------------------------------------------------------
create index items_owner_start_idx on public.items (owner_id, start_date);
create index items_category_idx    on public.items (category_id);
create index categories_parent_idx on public.categories (parent_id);
create index categories_owner_idx  on public.categories (owner_id);
