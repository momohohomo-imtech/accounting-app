-- 매입매출 등록 시 프로젝트를 아직 모를 때 "분류 대기 중"으로 표시해두고,
-- 나중에 담당자가 확인해서 실제 프로젝트로 재분류할 수 있게 하는 플래그.
alter table public.transactions add column if not exists needs_classification boolean not null default false;
