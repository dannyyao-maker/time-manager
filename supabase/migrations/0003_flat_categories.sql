-- =============================================================
-- 0003：類別改成只有一層（2026-11-06 決定）
-- 在 Supabase 後台 SQL Editor 執行一次。
--
-- 步驟：
--   1. 掛在第二層類別上的項目，移到它的上一層類別（不會刪掉任何項目）
--   2. 刪除已經沒有項目的第二層類別
--   3. 之後不允許再建立第二層
-- =============================================================

-- 1. 項目搬到上一層
update public.items i
set category_id = c.parent_id
from public.categories c
where i.category_id = c.id
  and c.parent_id is not null;

-- 2. 刪除第二層類別（上一步已經把項目都移走了）
delete from public.categories
where parent_id is not null
  and not exists (select 1 from public.items i where i.category_id = categories.id);

-- 3. 之後只允許一層
drop trigger if exists categories_check_depth on public.categories;
drop function if exists public.check_category_depth();

alter table public.categories
  add constraint categories_one_level check (parent_id is null);

-- 確認結果：應該是 0
select count(*) as 剩下的第二層類別 from public.categories where parent_id is not null;
