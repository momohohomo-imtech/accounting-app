-- 보고서 "AI 전망 · 인사이트" 대화를 저장해두고 나중에 다시 보거나 삭제할 수 있게 하는 테이블.
create table public.report_ai_insights (
    id          uuid primary key default gen_random_uuid(),
    year        int not null,
    title       text not null,
    messages    jsonb not null default '[]'::jsonb,
    created_by  uuid references public.users(id),
    created_at  timestamptz not null default now()
);

alter table public.report_ai_insights enable row level security;

-- 023_memos.sql과 동일한 admin_staff 전체 권한 패턴.
create policy "admin_staff all report_ai_insights" on public.report_ai_insights
  for all using (public.current_user_role() in ('admin', 'staff'))
  with check (public.current_user_role() in ('admin', 'staff'));
