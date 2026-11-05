-- =============================================================
-- 權限（RLS）測試
-- 用途：模擬「沒登入的人」「陌生人」「viewer（女友）」「owner（你）」，
--       確認每個人只能做被允許的事。
--
-- 怎麼用：
--   1. 先在網站上用你的 Google 帳號登入過一次，並確認 members 有你（owner）。
--   2. 把整個檔案貼到 Supabase 後台的 SQL Editor，按 Run。
--   3. 看結果表格的 pass 欄位：全部是 true 就代表權限正確。
--
-- 測試會暫時新增一筆測試項目和一個假的 viewer（example.com，不是真的信箱），
-- 跑完會自動刪掉，不會影響你的資料。
-- =============================================================

drop table if exists rls_test_results;
create temp table rls_test_results (
  no       integer,
  test     text,
  expected text,
  actual   text,
  pass     boolean
);

do $$
declare
  owner_uid   uuid;
  owner_email text;
  test_item   uuid;
  stranger    uuid := '00000000-0000-0000-0000-00000000aaaa';
  viewer      uuid := '00000000-0000-0000-0000-00000000bbbb';
  n           integer;
  r           text;
begin
  -- 找到你（owner）
  select u.id, u.email into owner_uid, owner_email
  from auth.users u
  join public.members m on lower(m.email) = lower(u.email) and m.role = 'owner'
  limit 1;

  if owner_uid is null then
    raise exception '找不到 owner：請先在網站上用 Google 登入一次，並確認 members 表裡有你（role = owner）';
  end if;

  -- 準備測試資料
  insert into public.items (owner_id, title, start_date, end_date)
  values (owner_uid, 'RLS 測試項目', current_date, current_date)
  returning id into test_item;

  insert into public.members (email, role, display_name)
  values ('rls-viewer-test@example.com', 'viewer', 'RLS 測試 viewer');

  -- ---------------------------------------------------------
  -- 1. 沒登入的人讀項目
  -- ---------------------------------------------------------
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    select count(*) into n from public.items;
    r := n || ' 筆';
  exception when insufficient_privilege then
    r := '被拒絕';
  end;
  reset role;
  insert into rls_test_results values (1, '沒登入的人：讀取項目', '被拒絕或 0 筆', r, r in ('被拒絕', '0 筆'));

  -- ---------------------------------------------------------
  -- 2～3. 陌生人（有登入，但不在名單）
  -- ---------------------------------------------------------
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', stranger, 'email', 'stranger-test@example.com', 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    select count(*) into n from public.items;
    r := n || ' 筆';
  exception when insufficient_privilege then
    r := '被拒絕';
  end;
  reset role;
  insert into rls_test_results values (2, '陌生人：讀取項目', '0 筆', r, r in ('0 筆', '被拒絕'));

  set local role authenticated;
  begin
    insert into public.items (owner_id, title, start_date, end_date)
    values (stranger, '陌生人想新增', current_date, current_date);
    r := '成功新增（危險！）';
  exception
    when insufficient_privilege then r := '被拒絕';
    when others then r := '其他錯誤：' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results values (3, '陌生人：新增項目', '被拒絕', r, r = '被拒絕');

  -- ---------------------------------------------------------
  -- 4～8. viewer（女友的角色）
  -- ---------------------------------------------------------
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', viewer, 'email', 'rls-viewer-test@example.com', 'role', 'authenticated')::text, true);

  set local role authenticated;
  select count(*) into n from public.items where id = test_item;
  reset role;
  insert into rls_test_results values (4, 'viewer：讀取項目', '看得到測試項目（1 筆）', n || ' 筆', n = 1);

  set local role authenticated;
  update public.items set title = 'viewer 想修改' where id = test_item;
  get diagnostics n = row_count;
  reset role;
  insert into rls_test_results values (5, 'viewer：修改項目', '0 筆被修改', n || ' 筆被修改', n = 0);

  set local role authenticated;
  begin
    insert into public.items (owner_id, title, start_date, end_date)
    values (viewer, 'viewer 想新增', current_date, current_date);
    r := '成功新增（危險！）';
  exception
    when insufficient_privilege then r := '被拒絕';
    when others then r := '其他錯誤：' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results values (6, 'viewer：新增項目', '被拒絕', r, r = '被拒絕');

  set local role authenticated;
  delete from public.items where id = test_item;
  get diagnostics n = row_count;
  reset role;
  insert into rls_test_results values (7, 'viewer：刪除項目', '0 筆被刪除', n || ' 筆被刪除', n = 0);

  set local role authenticated;
  select count(*) into n from public.members;
  reset role;
  insert into rls_test_results values (8, 'viewer：讀成員名單', '只看到自己（1 筆）', n || ' 筆', n = 1);

  set local role authenticated;
  begin
    insert into public.members (email, role) values ('another-test@example.com', 'owner');
    r := '成功新增（危險！）';
  exception
    when insufficient_privilege then r := '被拒絕';
    when others then r := '其他錯誤：' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results values (9, 'viewer：把別人加進名單', '被拒絕', r, r = '被拒絕');

  -- ---------------------------------------------------------
  -- 10. owner（你）可以修改
  -- ---------------------------------------------------------
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', owner_uid, 'email', owner_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.items set title = 'RLS 測試項目（owner 已修改）' where id = test_item;
  get diagnostics n = row_count;
  reset role;
  insert into rls_test_results values (10, 'owner：修改自己的項目', '1 筆被修改', n || ' 筆被修改', n = 1);

  -- 清掉測試資料
  delete from public.items where id = test_item;
  delete from public.members where email = 'rls-viewer-test@example.com';
end;
$$;

select * from rls_test_results order by no;
