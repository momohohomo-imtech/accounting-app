-- ============================================================
-- 세션 중 채팅으로만 전달했던 1회성 수정들을 저장소에 기록
-- (전부 이미 실행됨 / 멱등이라 다시 돌려도 안전)
-- ============================================================

-- 1) 국제파이프/경인금속/와이아이테크를 정식 거래처로 등록하고
--    client_name_raw만 있던 기존 거래에 client_id 연결
insert into public.clients (name, type)
select x.name, 'vendor' from (values
  ('국제파이프'),
  ('경인금속'),
  ('와이아이테크')
) as x(name)
where not exists (select 1 from public.clients c where c.name = x.name);

update public.transactions t
set client_id = c.id
from public.clients c
where t.client_id is null
  and t.client_name_raw = c.name;

-- 2) auth.users엔 있지만 public.users엔 없던 계정 채우기
--    (transactions.created_by FK 위반의 원인이었음)
insert into public.users (id, email, name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', u.email)
from auth.users u
where not exists (select 1 from public.users pu where pu.id = u.id);

-- 트리거 재설치 (신규 가입 시 자동 생성 보장)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3) "돌리 포지셔너 제작납품"을 "도장2 상도 정위치포지셔너"에 귀속
update public.projects
set parent_project_id = (select id from public.projects where name = '도장2 상도 정위치포지셔너')
where name = '돌리 포지셔너 제작납품'
  and parent_project_id is null;
