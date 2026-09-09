-- 공구명세서에 자유 기입 메모(비고)를 추가 — 인쇄물에도 같이 나옴.
alter table public.tool_checklists add column if not exists memo text;
