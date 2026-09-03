-- 공구별 "반입반출증용" 표시 — 공구명세서 중 반입/반출 확인증에 넣을 항목만
-- 골라서 인쇄/다운로드할 수 있게 함. 체크리스트 항목에도 저장 시점 값을
-- 스냅샷으로 남겨서(공구 마스터의 표시가 나중에 바뀌어도 과거 명세서는 안 변함),
-- 임의추가(수동 기입) 항목도 개별적으로 표시할 수 있게 함.
alter table public.tools add column if not exists for_access_pass boolean not null default false;
alter table public.tool_checklist_items add column if not exists for_access_pass boolean not null default false;
