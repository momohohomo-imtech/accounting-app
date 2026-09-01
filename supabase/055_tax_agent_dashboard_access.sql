-- 세무사(tax_agent) 계정이 대시보드(전반적인 수익현황)도 볼 수 있게 허용.
-- 대시보드는 transactions/credit_payments/projects(이미 052에서 허용)에 더해
-- project_agency_purchases(대행구매액, 이익금 예상 계산에 쓰임)도 조회하므로
-- 여기에도 읽기 전용 권한을 추가해야 함. 페이지 접근 자체는 middleware.ts에서
-- /dashboard 경로를 허용하도록 별도로 처리함.
drop policy if exists "tax_agent read project_agency_purchases" on public.project_agency_purchases;
create policy "tax_agent read project_agency_purchases" on public.project_agency_purchases
  for select using (public.current_user_role() = 'tax_agent');
