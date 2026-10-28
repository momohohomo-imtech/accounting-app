-- 거래 수정 이력 — 거래(매입·매출)를 고치거나 지우면 바뀌기 전·후 값을 누가·언제와 함께 남긴다(사용자 요청: 저장된 금액이
-- 바뀌면 안 된다는 원칙의 안전망). 등록은 거래 자체의 created_at·created_by로 알 수 있어 따로 안 남김.
-- 저장된 거래 데이터는 바꾸지 않음 — 새 표와 기록용 트리거만 생김. 두 번 실행해도 문제없음.
create table if not exists public.transaction_history (
    id              bigint generated always as identity primary key,
    transaction_id  uuid not null,
    action          text not null check (action in ('update', 'delete')),
    changed_at      timestamptz not null default now(),
    changed_by      uuid,
    old_row         jsonb not null,
    new_row         jsonb
);
create index if not exists transaction_history_transaction_idx
  on public.transaction_history (transaction_id, changed_at desc);
create index if not exists transaction_history_changed_at_idx
  on public.transaction_history (changed_at desc);

alter table public.transaction_history enable row level security;

-- 읽기: 장부를 볼 수 있는 계정 모두(admin/staff/세무사/조회 전용). 쓰기는 아래 트리거만 — 화면에서 직접 넣거나 고치거나
-- 지우는 정책은 만들지 않음(이력을 지울 수 없게).
drop policy if exists "read transaction_history" on public.transaction_history;
create policy "read transaction_history" on public.transaction_history
  for select using (public.current_user_role() in ('admin', 'staff', 'tax_agent', 'viewer'));

-- security definer: 거래를 고친 사람의 권한과 상관없이 이력 표에 쓸 수 있게(이력 표에는 쓰기 정책이 없음).
-- changed_by = 고친 사람(auth.uid()), 자동 백업 복원처럼 로그인 없이 바뀌면 비어 있음.
create or replace function public.log_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if to_jsonb(new) = to_jsonb(old) then
      return new; -- 바뀐 것이 없으면 안 남김
    end if;
    insert into public.transaction_history (transaction_id, action, changed_by, old_row, new_row)
    values (old.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  end if;
  insert into public.transaction_history (transaction_id, action, changed_by, old_row)
  values (old.id, 'delete', auth.uid(), to_jsonb(old));
  return old;
end;
$$;

drop trigger if exists trg_log_transaction_change on public.transactions;
create trigger trg_log_transaction_change
  after update or delete on public.transactions
  for each row execute function public.log_transaction_change();

-- PostgREST(Supabase API 레이어)가 새 표를 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
