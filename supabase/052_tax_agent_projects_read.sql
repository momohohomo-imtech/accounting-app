-- 세무사(tax_agent) 계정이 /transactions 목록에서 프로젝트명을 볼 수 있게.
-- 019번에서 tax_agent 읽기 권한을 transactions/credit_payments/clients/
-- payment_methods/expense_categories로만 줬는데 projects가 빠져 있어서,
-- 거래에 project_id가 있어도 조인(projects(name))이 RLS로 막혀 빈 값이 되고
-- 화면엔 "일반경비"로 잘못 표시됐음(실제로 프로젝트가 없는 게 아니라 조회 권한
-- 문제였음). 읽기 전용으로만 추가 — 쓰기 권한은 여전히 admin/staff만.
drop policy if exists "tax_agent read projects" on public.projects;
create policy "tax_agent read projects" on public.projects
  for select using (public.current_user_role() = 'tax_agent');
