-- 메모장: 왼쪽 메뉴 "보고서" 아래에 추가하는 자유 형식 메모(제목+내용) 테이블.
create table public.memos (
    id          uuid primary key default gen_random_uuid(),
    title       text not null,
    content     text,
    created_by  uuid references public.users(id),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

alter table public.memos enable row level security;

-- 019_role_based_access.sql과 동일한 admin_staff 전체 권한 패턴 (tax_agent는 접근 불가 —
-- 어차피 메모장 메뉴 자체가 tax_agent 로그인에서는 보이지 않음).
create policy "admin_staff all memos" on public.memos
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
