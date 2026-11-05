-- =============================================================
-- 把人加進成員名單（範本）
--
-- 怎麼用：
--   1. 把這段複製到 Supabase 後台的 SQL Editor。
--   2. 只在 SQL Editor 裡，把 your-email@example.com 換成真正的 Gmail。
--   3. 按 Run。
--
-- 注意：不要把填了真實 Gmail 的版本存回這個檔案（repo 是公開的）。
-- role：owner = 可編輯（你）；viewer = 只能讀（女友，階段 6 再加）
-- =============================================================

insert into public.members (email, role, display_name)
values ('your-email@example.com', 'owner', '你的名字');
