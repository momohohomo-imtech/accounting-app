-- 정책이 하나도 생성되지 않은 경우에만 실행하세요.
-- 이미 일부 정책이 있다면 먼저 지우고 실행해야 "already exists" 에러가 안 납니다.

create policy "authenticated read users" on public.users for select using (auth.role() = 'authenticated');
create policy "self update users" on public.users for update using (auth.uid() = id);

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clients','sites','projects','transactions','credit_payments','work_logs',
      'employees','payroll','daily_worker_offices','daily_workers',
      'access_lists','access_list_workers','bank_accounts','bank_transactions','backups'
    ])
  loop
    execute format('create policy "authenticated all %1$s" on public.%1$s for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');', t);
  end loop;
end $$;

-- 실행 후 확인:
select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
