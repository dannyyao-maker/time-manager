-- =============================================================
-- 權限（RLS）測試：第二版（個人／共用、女友可編輯、備忘錄）
-- 用途：模擬「沒登入的人」「陌生人」「viewer」「editor（女友）」「owner（你）」，
--       確認每個人只能做被允許的事。需要先執行 migrations 0001～0005。
--
-- 怎麼用：
--   1. 確認 members 有你（role = owner），而且登入過網站。
--   2. 把整個檔案貼到 Supabase 後台的 SQL Editor，按 Run。
--   3. 看結果表格的 pass 欄位：全部是 true 就代表權限正確。
--
-- 測試會暫時建立假的 editor、viewer 帳號（example.com，不是真的信箱）和幾筆測試項目，
-- 全部放在一個「最後一定會整批撤銷」的區塊裡，跑完不會留下任何東西。
-- =============================================================

drop table if exists rls_test_results;
create temp table rls_test_results (no integer, test text, expected text, actual text, pass boolean);

-- 小工具：切換成某個身分（模擬那個人登入）
create or replace function pg_temp.act_as(p_role text, p_uid uuid, p_email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'email', p_email, 'role', p_role)::text, true);
  if p_role = 'anon' then
    set local role anon;
  else
    set local role authenticated;
  end if;
end;
$$;

do $$
declare
  owner_uid   uuid;
  owner_email text;
  ed          uuid := '00000000-0000-0000-0000-0000000000e1';
  ed_email    text := 'rls-editor-test@example.com';
  vw          uuid := '00000000-0000-0000-0000-0000000000b1';
  vw_email    text := 'rls-viewer-test@example.com';
  st          uuid := '00000000-0000-0000-0000-0000000000a1';
  st_email    text := 'stranger-test@example.com';
  my_personal uuid;
  my_shared   uuid;
  her_personal uuid;
  my_series   uuid;
  my_cat      uuid;
  res         jsonb := '[]'::jsonb;
  n           integer;
  r           text;
  owner_after uuid;
  my_memo     uuid;
  memo_item   uuid;
begin
  select u.id, u.email into owner_uid, owner_email
  from auth.users u
  join public.members m on lower(m.email) = lower(u.email) and m.role = 'owner'
  limit 1;
  if owner_uid is null then
    raise exception '找不到 owner：請先在網站上用 Google 登入一次，並確認 members 表裡有你（role = owner）';
  end if;

  begin  -- ===== 這個區塊裡的所有資料，最後都會被撤銷 =====
    insert into auth.users (id, email) values (ed, ed_email);
    insert into public.members (email, role, display_name) values
      (ed_email, 'editor', 'RLS 測試 editor'),
      (vw_email, 'viewer', 'RLS 測試 viewer');

    insert into public.categories (owner_id, name, color) values (owner_uid, 'RLS 測試類別', '#3D8FE0')
      returning id into my_cat;
    insert into public.items (owner_id, title, start_date, end_date, calendar)
      values (owner_uid, 'RLS 我的個人', current_date, current_date, 'personal') returning id into my_personal;
    insert into public.items (owner_id, title, start_date, end_date, calendar)
      values (owner_uid, 'RLS 共用', current_date, current_date, 'shared') returning id into my_shared;
    insert into public.items (owner_id, title, start_date, end_date, calendar)
      values (ed, 'RLS 她的個人', current_date, current_date, 'personal') returning id into her_personal;
    insert into public.items (owner_id, title, start_date, end_date, calendar, repeat_freq)
      values (owner_uid, 'RLS 我的重複', current_date, current_date, 'personal', 'weekly') returning id into my_series;

    -- 1. 沒登入的人讀取
    perform pg_temp.act_as('anon', null, null);
    begin select count(*) into n from public.items; r := n || ' 筆';
    exception when insufficient_privilege then r := '被拒絕'; end;
    reset role;
    res := res || jsonb_build_object('no', 1, 'test', '沒登入的人：讀取項目', 'expected', '被拒絕或 0 筆', 'actual', r, 'pass', r in ('被拒絕', '0 筆'));

    -- 2～3. 陌生人
    perform pg_temp.act_as('authenticated', st, st_email);
    select count(*) into n from public.items; r := n || ' 筆';
    reset role;
    res := res || jsonb_build_object('no', 2, 'test', '陌生人：讀取項目', 'expected', '0 筆', 'actual', r, 'pass', n = 0);

    perform pg_temp.act_as('authenticated', st, st_email);
    begin insert into public.items (owner_id, title, start_date, end_date, calendar) values (st, 'x', current_date, current_date, 'shared');
      r := '成功新增（危險！）';
    exception when insufficient_privilege then r := '被拒絕'; when others then r := '其他錯誤：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 3, 'test', '陌生人：新增共用項目', 'expected', '被拒絕', 'actual', r, 'pass', r = '被拒絕');

    -- 4～5. viewer
    perform pg_temp.act_as('authenticated', vw, vw_email);
    select count(*) into n from public.items where id in (my_personal, my_shared, her_personal);
    reset role;
    res := res || jsonb_build_object('no', 4, 'test', 'viewer：讀取項目', 'expected', '3 筆', 'actual', n || ' 筆', 'pass', n = 3);

    perform pg_temp.act_as('authenticated', vw, vw_email);
    update public.items set title = 'viewer 改' where id = my_shared; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 5, 'test', 'viewer：修改共用項目', 'expected', '0 筆被修改', 'actual', n || ' 筆被修改', 'pass', n = 0);

    -- 6～17. editor（女友）
    perform pg_temp.act_as('authenticated', ed, ed_email);
    select count(*) into n from public.items where id = my_personal;
    reset role;
    res := res || jsonb_build_object('no', 6, 'test', 'editor：讀取我的個人行程（畫面顯示忙碌）', 'expected', '1 筆', 'actual', n || ' 筆', 'pass', n = 1);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    update public.items set title = 'editor 改' where id = my_personal; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 7, 'test', 'editor：修改我的個人行程', 'expected', '0 筆被修改', 'actual', n || ' 筆被修改', 'pass', n = 0);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    delete from public.items where id = my_personal; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 8, 'test', 'editor：刪除我的個人行程', 'expected', '0 筆被刪除', 'actual', n || ' 筆被刪除', 'pass', n = 0);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    update public.items set title = 'RLS 共用（editor 改過）' where id = my_shared; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 9, 'test', 'editor：修改共用項目', 'expected', '1 筆被修改', 'actual', n || ' 筆被修改', 'pass', n = 1);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    begin update public.items set calendar = 'personal' where id = my_shared; r := '成功（危險！）';
    exception when insufficient_privilege then r := '被拒絕'; when others then r := '其他錯誤：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 10, 'test', 'editor：把我建的共用項目改成個人', 'expected', '被拒絕', 'actual', r, 'pass', r = '被拒絕');

    perform pg_temp.act_as('authenticated', ed, ed_email);
    update public.items set owner_id = ed where id = my_shared;
    reset role;
    select owner_id into owner_after from public.items where id = my_shared;
    res := res || jsonb_build_object('no', 11, 'test', 'editor：把共用項目的擁有者改成自己', 'expected', '擁有者不變', 'actual',
      case when owner_after = owner_uid then '擁有者不變' else '被改掉了（危險！）' end, 'pass', owner_after = owner_uid);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    begin insert into public.items (owner_id, title, start_date, end_date, calendar) values (ed, 'editor 自己的', current_date, current_date, 'personal');
      r := '成功';
    exception when others then r := '失敗：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 12, 'test', 'editor：新增自己的個人行程', 'expected', '成功', 'actual', r, 'pass', r = '成功');

    perform pg_temp.act_as('authenticated', ed, ed_email);
    begin insert into public.items (owner_id, title, start_date, end_date, calendar) values (ed, 'editor 建的共用', current_date, current_date, 'shared');
      r := '成功';
    exception when others then r := '失敗：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 13, 'test', 'editor：新增共用項目', 'expected', '成功', 'actual', r, 'pass', r = '成功');

    perform pg_temp.act_as('authenticated', ed, ed_email);
    begin insert into public.items (owner_id, title, start_date, end_date, calendar, category_id) values (ed, 'x', current_date, current_date, 'personal', my_cat);
      r := '成功（危險！）';
    exception when insufficient_privilege then r := '被拒絕'; when others then r := '其他錯誤：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 14, 'test', 'editor：用我的類別新增項目', 'expected', '被拒絕', 'actual', r, 'pass', r = '被拒絕');

    perform pg_temp.act_as('authenticated', ed, ed_email);
    begin insert into public.occurrence_overrides (item_id, occurrence_date, is_cancelled) values (my_series, current_date, true);
      r := '成功（危險！）';
    exception when insufficient_privilege then r := '被拒絕'; when others then r := '其他錯誤：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 15, 'test', 'editor：把我的重複行程刪掉一次', 'expected', '被拒絕', 'actual', r, 'pass', r = '被拒絕');

    perform pg_temp.act_as('authenticated', ed, ed_email);
    select count(*) into n from public.members;
    reset role;
    res := res || jsonb_build_object('no', 16, 'test', 'editor：讀成員名單', 'expected', '只看到自己（1 筆）', 'actual', n || ' 筆', 'pass', n = 1);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    begin insert into public.members (email, role) values ('another-test@example.com', 'owner'); r := '成功（危險！）';
    exception when insufficient_privilege then r := '被拒絕'; when others then r := '其他錯誤：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 17, 'test', 'editor：把別人加進名單', 'expected', '被拒絕', 'actual', r, 'pass', r = '被拒絕');

    -- 18～21. owner（你）
    perform pg_temp.act_as('authenticated', owner_uid, owner_email);
    update public.items set title = 'owner 改' where id = her_personal; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 18, 'test', 'owner：修改女友的個人行程', 'expected', '0 筆被修改', 'actual', n || ' 筆被修改', 'pass', n = 0);

    perform pg_temp.act_as('authenticated', owner_uid, owner_email);
    update public.items set title = 'RLS 我的個人（改過）' where id = my_personal; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 19, 'test', 'owner：修改自己的個人行程', 'expected', '1 筆被修改', 'actual', n || ' 筆被修改', 'pass', n = 1);

    perform pg_temp.act_as('authenticated', owner_uid, owner_email);
    begin insert into public.items (owner_id, title, start_date, end_date, calendar, category_id) values (owner_uid, 'x', current_date, current_date, 'shared', my_cat);
      r := '成功（不應該）';
    exception when check_violation then r := '被擋下'; when others then r := '其他錯誤：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 20, 'test', 'owner：共用項目加類別', 'expected', '被擋下（共用不分類）', 'actual', r, 'pass', r = '被擋下');

    perform pg_temp.act_as('authenticated', owner_uid, owner_email);
    delete from public.items where id = my_shared; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 21, 'test', 'owner：刪除共用項目', 'expected', '1 筆被刪除', 'actual', n || ' 筆被刪除', 'pass', n = 1);

    -- 22～23. 成員名冊（共用行事曆顯示「點」「宛」用）
    perform pg_temp.act_as('authenticated', st, st_email);
    select count(*) into n from public.member_directory();
    reset role;
    res := res || jsonb_build_object('no', 22, 'test', '陌生人：讀成員名冊', 'expected', '0 筆', 'actual', n || ' 筆', 'pass', n = 0);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    select count(*) into n from public.member_directory() d where d.user_id in (owner_uid, ed);
    reset role;
    res := res || jsonb_build_object('no', 23, 'test', 'editor：讀成員名冊（只有名字和角色，沒有 Email）', 'expected', '看到 2 人', 'actual', n || ' 人', 'pass', n = 2);

    -- 24～28. 備忘錄（只有自己看得到；排到某天＝變成待辦、備忘錄刪掉）
    perform pg_temp.act_as('authenticated', owner_uid, owner_email);
    begin insert into public.memos (owner_id, text) values (owner_uid, 'RLS 測試備忘錄') returning id into my_memo;
      r := '成功';
    exception when others then r := '失敗：' || sqlerrm; end;
    reset role;
    res := res || jsonb_build_object('no', 24, 'test', 'owner：新增備忘錄', 'expected', '成功', 'actual', r, 'pass', r = '成功');

    perform pg_temp.act_as('authenticated', ed, ed_email);
    select count(*) into n from public.memos where id = my_memo;
    reset role;
    res := res || jsonb_build_object('no', 25, 'test', 'editor：讀我的備忘錄', 'expected', '0 筆', 'actual', n || ' 筆', 'pass', n = 0);

    perform pg_temp.act_as('authenticated', ed, ed_email);
    begin perform public.schedule_memo(my_memo, current_date); r := '成功（危險！）';
    exception when others then r := '被拒絕'; end;
    reset role;
    res := res || jsonb_build_object('no', 26, 'test', 'editor：把我的備忘錄排到某天', 'expected', '被拒絕', 'actual', r, 'pass', r = '被拒絕');

    perform pg_temp.act_as('authenticated', ed, ed_email);
    delete from public.memos where id = my_memo; get diagnostics n = row_count;
    reset role;
    res := res || jsonb_build_object('no', 27, 'test', 'editor：刪除我的備忘錄', 'expected', '0 筆被刪除', 'actual', n || ' 筆被刪除', 'pass', n = 0);

    perform pg_temp.act_as('authenticated', owner_uid, owner_email);
    begin
      memo_item := public.schedule_memo(my_memo, current_date);
      r := '成功';
    exception when others then r := '失敗：' || sqlerrm; end;
    reset role;
    select count(*) into n from public.items where id = memo_item and is_task and owner_id = owner_uid and title = 'RLS 測試備忘錄';
    r := r || case when n = 1 then '，變成待辦' else '，沒有待辦' end;
    select count(*) into n from public.memos where id = my_memo;
    r := r || case when n = 0 then '，備忘錄已刪' else '，備忘錄還在' end;
    res := res || jsonb_build_object('no', 28, 'test', 'owner：把備忘錄排到某天', 'expected', '成功，變成待辦，備忘錄已刪', 'actual', r, 'pass', r = '成功，變成待辦，備忘錄已刪');

    -- 撤銷這個區塊裡的所有資料
    raise exception using errcode = 'P0099', message = 'rollback test data';
  exception when sqlstate 'P0099' then
    null;
  end;

  insert into rls_test_results
  select (x ->> 'no')::int, x ->> 'test', x ->> 'expected', x ->> 'actual', (x ->> 'pass')::boolean
  from jsonb_array_elements(res) x;
end;
$$;

select * from rls_test_results order by no;
