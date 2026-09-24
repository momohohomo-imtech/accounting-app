-- 조회 전용(viewer) 역할 — 확인·점검용 계정. 읽기만 가능하고 저장·수정·삭제는 DB가 거절한다
-- (insert/update/delete 정책을 아예 만들지 않음 — 화면에 버튼이 보여도 눌러서 바뀌는 것이 없음).
-- 개인정보가 있는 표(직원·급여·일용직·일용직 사용기록·출입명단)와 백업은 읽기도 막는다.
-- 계정 관리(역할 지정, N시간만 열기)는 기존 관리자 화면(백업 페이지의 계정 관리)에서 한다.
-- 저장된 데이터는 바꾸지 않음 — 권한 규칙만 추가.

-- 읽기 허용 표(개인정보 없는 업무 데이터).
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clients','sites','projects','transactions','credit_payments','work_logs',
      'bank_accounts','bank_transactions','payment_methods','expense_categories',
      'attachments','business_trip_logs','construction_stages','half_year_settlements',
      'know_how_notes','memos','project_agency_purchases','projects_page_memo',
      'purchase_orders','purchase_order_items','quality_checklist_items',
      'quotes','quote_items','report_ai_insights',
      'tools','tool_checklists','tool_checklist_items','work_log_summary_checks'
    ])
  loop
    execute format('drop policy if exists "viewer read %1$s" on public.%1$s;', t);
    execute format(
      'create policy "viewer read %1$s" on public.%1$s for select using (public.current_user_role() = ''viewer'');',
      t
    );
  end loop;
end $$;

-- 파일: 영수증·프로젝트 첨부파일은 보기만. (백업 파일은 admin/staff 전용 그대로)
-- (영수증 버킷은 지금 앱에서 쓰지 않지만) 예전 정책이 "로그인한 누구나 전체 권한"이라, 조회 전용·세무사 계정도 파일을
-- 올리거나 지울 수 있었음 → admin/staff 전체 권한 + 세무사·조회 전용 읽기만으로 나눔.
drop policy if exists "authenticated receipts access" on storage.objects;
drop policy if exists "admin_staff receipts access" on storage.objects;
create policy "admin_staff receipts access" on storage.objects
  for all using (bucket_id = 'receipts' and public.current_user_role() in ('admin', 'staff'))
  with check (bucket_id = 'receipts' and public.current_user_role() in ('admin', 'staff'));
drop policy if exists "readonly receipts read" on storage.objects;
create policy "readonly receipts read" on storage.objects
  for select using (bucket_id = 'receipts' and public.current_user_role() in ('tax_agent', 'viewer'));

drop policy if exists "viewer project_files read" on storage.objects;
create policy "viewer project_files read" on storage.objects
  for select using (bucket_id = 'project-files' and public.current_user_role() = 'viewer');
