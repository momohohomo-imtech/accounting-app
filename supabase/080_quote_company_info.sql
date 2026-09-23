-- 견적서 인쇄화면의 공급자(회사) 정보를 견적서별로 직접 수정해서 저장할 수 있게.
-- null이면 화면의 기본값(아이엠테크 등)을 그대로 씀 — 새 견적서는 항상 null로 시작.
alter table public.quotes add column if not exists company_info jsonb;
