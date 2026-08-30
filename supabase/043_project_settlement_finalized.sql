-- 수주액-발주액(-대행구매액) 불일치로 프로젝트명이 노란색으로 표시되는 프로젝트라도,
-- 결산 정리가 끝났으면 /projects·/reports 목록에서는 일반 검정으로 되돌리기 위한 체크박스.
-- 프로젝트별 손익보고서 팝업 안의 경고 문구는 이 값과 무관하게 항상 그대로 노란색 유지.
alter table public.projects
  add column if not exists settlement_finalized boolean not null default false;
