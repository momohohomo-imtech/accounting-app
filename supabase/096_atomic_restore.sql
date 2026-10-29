-- 백업 복원을 DB 안에서 한 번에(트랜잭션 하나로) — 중간에 하나라도 실패하면 DB는 복원 전 그대로 남는다.
-- 예전 복원(앱이 표마다 지우고 다시 넣기)은
--   ① 거래처에 "기본 카테고리"가 지정돼 있으면 거래처를 카테고리보다 먼저 넣다가 실패해, 표가 전부 빈 채로 끝났고
--   ② 백업에 없는 표(공사 메모·품질 점검·일용직 사용내역 등)가 프로젝트·일용직을 지울 때 같이 지워졌고
--   ③ 중간에 끊기면 일부만 복원된 채로 남았음.
-- 흐름: 앱(lib/restore.ts)이 백업 파일의 줄을 나눠 restore_stage로 올림(한 요청이 너무 커지지 않게, 이때는 아무것도 안 바뀜)
--   → restore_commit이 한 번에: 올라온 줄 수 확인 → 바꿀 표 + 그 표를 참조하는 나머지 표(지우면 같이 지워지거나 연결이 끊기는 표)의
--   지금 자료를 잠시 보관 → 자식 → 부모 순서로 비움 → 부모 → 자식 순서로 백업 내용을 넣음 → 보관한 나머지 표를 되돌려 넣음
--   (그 사이 없어진 프로젝트 등을 가리키던 줄은 원래 삭제 규칙대로 빼거나 연결만 비움).
-- 새 표 1개(restore_staging — 복원하는 동안만 쓰는 임시 보관함, 끝나면 비움)와 함수 5개 추가. 저장된 데이터는 바꾸지 않음.
-- 두 번 실행해도 문제없음.

create table if not exists public.restore_staging (
  id          bigint generated always as identity primary key,
  restore_id  uuid not null,
  table_name  text not null,
  rows        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_restore_staging_restore on public.restore_staging (restore_id, table_name, id);
-- 정책 없음 = 화면·API로는 읽지도 쓰지도 못함(아래 함수로만).
alter table public.restore_staging enable row level security;

-- 복원할 수 있는 표 — 앱의 lib/restore.ts RESTORE_TABLES와 같게(검사 restore.test.ts가 이 목록과 비교함).
-- 회사 정보(company_profiles)는 설정값이라 백업 파일에만 담고 복원하지 않음. users·backups·transaction_history는 복원 대상 아님.
create or replace function public.restore_allowed_tables()
returns text[]
language sql
immutable
as $$
  select array[
    'clients', 'sites', 'projects', 'payment_methods', 'expense_categories', 'transactions', 'credit_payments',
    'work_logs', 'employees', 'payroll', 'daily_worker_offices', 'daily_workers', 'daily_worker_usage_logs',
    'access_lists', 'access_list_workers', 'bank_accounts', 'bank_transactions', 'memos', 'business_trip_logs',
    'project_agency_purchases', 'attachments', 'quotes', 'quote_items', 'trip_logs', 'trip_log_days',
    'construction_memos', 'construction_stages', 'quality_checklist_items', 'tools', 'tool_checklists',
    'tool_checklist_items', 'purchase_orders', 'purchase_order_items', 'know_how_notes', 'vat_prepayment_notices',
    'half_year_settlements', 'work_log_summary_checks', 'dashboard_page_memo', 'transactions_page_memo',
    'projects_page_memo'
  ]::text[]
$$;

-- 백업 화면을 쓸 수 있는 관리자·직원만(백업 표 정책과 같게).
create or replace function public.restore_require_role()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'staff') then
    raise exception '복원 권한이 없습니다.';
  end if;
end;
$$;

-- 백업 파일의 한 표 일부(여러 줄)를 임시 보관함에 올림 — 이것만으로는 아무것도 안 바뀜.
create or replace function public.restore_stage(p_restore_id uuid, p_table text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.restore_require_role();
  if p_restore_id is null or not (p_table = any(public.restore_allowed_tables())) then
    raise exception '복원할 수 없는 표입니다: %', p_table;
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception '% 표 자료 형식이 올바르지 않습니다.', p_table;
  end if;
  -- 중간에 멈춘 예전 복원이 남긴 자료 정리
  delete from public.restore_staging where created_at < now() - interval '1 day';
  insert into public.restore_staging (restore_id, table_name, rows) values (p_restore_id, p_table, p_rows);
end;
$$;

-- 복원을 그만둘 때(앱에서 오류가 났을 때) 올린 자료만 지움.
create or replace function public.restore_discard(p_restore_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.restore_require_role();
  delete from public.restore_staging where restore_id = p_restore_id;
end;
$$;

-- 올린 자료로 한 번에 복원. p_counts = { 표 이름: 백업 파일의 줄 수 } — 여기 적힌 표를 백업 내용으로 바꾼다(0줄이면 비움).
-- 적히지 않은 표는 그대로 두되, 바꾸는 표를 참조하는 표는 지금 자료를 보관했다가 되돌려 넣는다.
create or replace function public.restore_commit(p_restore_id uuid, p_counts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
declare
  v_replace oid[];   -- 백업 내용으로 바꿀 표
  v_keep oid[];      -- 바꾸는 표를 참조해서 지금 자료를 보관했다 되돌릴 표
  v_all oid[];       -- 둘 다(부모 → 자식 순서로 정렬됨)
  v_left oid[];
  v_ready oid[];
  v_rel oid;
  v_name text;
  v_tmp text;
  v_key text;
  v_n bigint;
  v_expected bigint;
  v_cols text;
  v_exprs text;
  v_fk record;
  v_changed bigint;
  v_replaced jsonb := '{}'::jsonb;
  v_kept jsonb := '{}'::jsonb;
begin
  perform public.restore_require_role();
  if p_restore_id is null or jsonb_typeof(p_counts) is distinct from 'object' then
    raise exception '복원할 표 목록이 올바르지 않습니다.';
  end if;
  -- 복원은 한 번에 하나씩(두 사람이 동시에 눌러도 차례로)
  perform pg_advisory_xact_lock(hashtext('public.restore_commit'));

  -- 올린 자료를 이 복원만 쓰는 임시 표로 옮김 — 앱이 정리(restore_discard)를 동시에 불러도 이 복원에는 영향이 없게.
  -- (실패하면 옮긴 것도 취소돼 보관함에 그대로 남음)
  drop table if exists pg_temp._restore_rows;
  create temp table _restore_rows (id bigint, table_name text, rows jsonb) on commit drop;
  with moved as (
    delete from public.restore_staging where restore_id = p_restore_id returning id, table_name, rows
  )
  insert into pg_temp._restore_rows select id, table_name, rows from moved;

  -- 1) 바꿀 표 확인 + 올라온 줄 수가 백업 파일과 같은지(덜 올라왔으면 막음)
  v_replace := '{}';
  for v_key in select jsonb_object_keys(p_counts) loop
    if not (v_key = any(public.restore_allowed_tables())) then
      raise exception '복원할 수 없는 표입니다: %', v_key;
    end if;
    v_rel := to_regclass(format('public.%I', v_key));
    if v_rel is null then
      raise exception '% 표가 없습니다(Supabase에서 SQL을 순서대로 실행했는지 확인).', v_key;
    end if;
    v_expected := (p_counts ->> v_key)::bigint;
    select coalesce(sum(jsonb_array_length(s.rows)), 0) into v_n from pg_temp._restore_rows s where s.table_name = v_key;
    if v_n <> v_expected then
      raise exception '% 표 자료가 다 올라오지 않았습니다(%/%줄). 다시 시도해주세요.', v_key, v_n, v_expected;
    end if;
    v_replace := v_replace || v_rel;
  end loop;
  if cardinality(v_replace) = 0 then
    raise exception '복원할 표가 없습니다.';
  end if;
  if exists (
    select 1 from pg_temp._restore_rows s where not (s.table_name = any(array(select jsonb_object_keys(p_counts))))
  ) then
    raise exception '복원할 표 목록에 없는 자료가 올라와 있습니다.';
  end if;

  -- 2) 바꾸는 표를 (거쳐서라도) 참조하는 나머지 표 — 바꾸는 표를 비우면 같이 지워지거나 연결이 끊기므로 보관했다 되돌림.
  with recursive dep(rel) as (
    select c.conrelid from pg_constraint c
     where c.contype = 'f' and c.confrelid = any(v_replace) and not (c.conrelid = any(v_replace))
    union
    select c.conrelid from pg_constraint c join dep d on c.confrelid = d.rel
     where c.contype = 'f' and not (c.conrelid = any(v_replace))
  )
  select coalesce(array_agg(distinct rel), '{}') into v_keep from dep;

  -- 3) 부모 → 자식 순서(서로 참조하는 표끼리만 봄, 자기 참조는 한 번에 넣어서 상관없음)
  v_left := v_replace || v_keep;
  v_all := '{}';
  while cardinality(v_left) > 0 loop
    select coalesce(array_agg(r order by r::regclass::text), '{}') into v_ready
      from unnest(v_left) r
     where not exists (
       select 1 from pg_constraint c
        where c.contype = 'f' and c.conrelid = r and c.confrelid <> r and c.confrelid = any(v_left)
     );
    if cardinality(v_ready) = 0 then
      raise exception '표 순서를 정할 수 없습니다(서로 참조하는 표).';
    end if;
    v_all := v_all || v_ready;
    v_left := array(select x from unnest(v_left) x where not (x = any(v_ready)));
  end loop;

  -- 4) 보관할 표의 지금 자료를 임시 표로(이 트랜잭션이 끝나면 사라짐)
  foreach v_rel in array v_keep loop
    v_tmp := '_restore_keep_' || v_rel::oid::text;
    execute format('drop table if exists pg_temp.%I', v_tmp);
    execute format('create temp table %I on commit drop as select * from %s', v_tmp, v_rel::regclass);
  end loop;

  -- 5) 자식 → 부모 순서로 비움
  for i in reverse cardinality(v_all) .. 1 loop
    execute format('delete from %s', v_all[i]::regclass);
  end loop;

  -- 6) 부모 → 자식 순서로 채움
  foreach v_rel in array v_all loop
    v_name := (select c.relname from pg_class c where c.oid = v_rel);
    if v_rel = any(v_replace) then
      -- 백업 파일 내용. 백업에 있는 칸만 넣음(백업 뒤에 생긴 칸은 기본값). 없는 계정을 가리키는 작성자처럼, 바꾸지 않는 표를
      -- 가리키는 연결이 끊겼으면 빈칸으로(빈칸이 안 되는 칸이면 그대로 둬서 오류 → 복원 전체 취소).
      select string_agg(format('%I', a.attname), ', ' order by a.attnum),
             string_agg(
               case
                 when fk.confrelid is not null and not a.attnotnull then
                   format('(select x.%I from %s x where x.%I = r.%I)', fk.refcol, fk.confrelid::regclass, fk.refcol, a.attname)
                 else format('r.%I', a.attname)
               end, ', ' order by a.attnum)
        into v_cols, v_exprs
        from pg_attribute a
        left join lateral (
          select c.confrelid, ra.attname as refcol
            from pg_constraint c
            join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]
           where c.contype = 'f' and c.conrelid = v_rel and c.conkey = array[a.attnum]
             and not (c.confrelid = any(v_replace))
           limit 1
        ) fk on true
       where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
         and exists (
           select 1 from pg_temp._restore_rows s, jsonb_array_elements(s.rows) e
            where s.table_name = v_name and e ? a.attname
         );
      if v_cols is not null then
        execute format(
          'insert into %s (%s) overriding system value select %s from pg_temp._restore_rows s '
          || 'cross join lateral jsonb_populate_recordset(null::%s, s.rows) r '
          || 'where s.table_name = $1 order by s.id',
          v_rel::regclass, v_cols, v_exprs, v_rel::regclass
        ) using v_name;
      end if;
      execute format('select count(*) from %s', v_rel::regclass) into v_n;
      v_replaced := v_replaced || jsonb_build_object(v_name, v_n);
    else
      -- 보관한 자료 되돌리기. 가리키던 줄이 복원 뒤 없으면 그 연결의 삭제 규칙대로: 같이 삭제(cascade)면 그 줄을 빼고,
      -- 연결 끊기(set null)·삭제 막기(restrict/no action)면 빈칸으로(빈칸이 안 되는 칸이면 그 줄을 뺌).
      v_tmp := '_restore_keep_' || v_rel::oid::text;
      loop
        v_changed := 0;
        for v_fk in
          select a.attname as col, a.attnotnull as notnull, c.confdeltype as action, c.confrelid, ra.attname as refcol
            from pg_constraint c
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]
           where c.contype = 'f' and c.conrelid = v_rel and c.confrelid = any(v_all)
        loop
          -- 자기 표를 가리키는 연결은 아직 비어 있는 진짜 표 대신 보관한 자료에서 찾음
          v_key := case when v_fk.confrelid = v_rel then format('pg_temp.%I', v_tmp) else v_fk.confrelid::regclass::text end;
          if v_fk.action = 'c' or v_fk.notnull then
            execute format(
              'delete from pg_temp.%I k where k.%I is not null and not exists (select 1 from %s p where p.%I = k.%I)',
              v_tmp, v_fk.col, v_key, v_fk.refcol, v_fk.col
            );
          else
            execute format(
              'update pg_temp.%I k set %I = null where k.%I is not null and not exists (select 1 from %s p where p.%I = k.%I)',
              v_tmp, v_fk.col, v_fk.col, v_key, v_fk.refcol, v_fk.col
            );
          end if;
          get diagnostics v_n = row_count;
          v_changed := v_changed + v_n;
        end loop;
        -- 자기 표를 가리키는 연결만 다시 확인하면 됨(다른 표는 이미 다 들어가 있음) — 바뀐 게 없을 때까지
        exit when v_changed = 0 or not exists (
          select 1 from pg_constraint c where c.contype = 'f' and c.conrelid = v_rel and c.confrelid = v_rel
        );
      end loop;
      select string_agg(format('%I', a.attname), ', ' order by a.attnum) into v_cols
        from pg_attribute a
       where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';
      execute format('insert into %s (%s) overriding system value select %s from pg_temp.%I',
                     v_rel::regclass, v_cols, v_cols, v_tmp);
      get diagnostics v_n = row_count;
      v_kept := v_kept || jsonb_build_object(v_name, v_n);
    end if;
  end loop;

  return jsonb_build_object('replaced', v_replaced, 'kept', v_kept);
end;
$$;

revoke all on function public.restore_require_role() from public, anon, authenticated;
revoke all on function public.restore_stage(uuid, text, jsonb) from public, anon;
revoke all on function public.restore_discard(uuid) from public, anon;
revoke all on function public.restore_commit(uuid, jsonb) from public, anon;
grant execute on function public.restore_stage(uuid, text, jsonb) to authenticated;
grant execute on function public.restore_discard(uuid) to authenticated;
grant execute on function public.restore_commit(uuid, jsonb) to authenticated;

-- PostgREST(Supabase API 레이어)가 새 함수를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
