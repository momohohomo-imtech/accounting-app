-- 공구 마스터 목록: "분류"(자유 텍스트) 대신 "순번"(숫자, 정렬 기준)을 씀.
-- 기존 category 컬럼은 데이터 보존을 위해 그대로 두고(더 이상 화면에서 안 씀),
-- sort_order(순번)와 같은 순번 안에서 사용자가 직접 위/아래로 옮길 수 있는
-- 보조 정렬값(position)을 추가.
alter table public.tools add column if not exists sort_order integer not null default 0;
alter table public.tools add column if not exists position integer not null default 0;

-- 공구명세서 품목의 수량을 숫자 전용에서 자유 텍스트로 바꿔서(예: "2개", "여분1")
-- 순수 개수가 아닌 메모성 값도 적을 수 있게 함.
alter table public.tool_checklist_items alter column quantity drop default;
alter table public.tool_checklist_items alter column quantity type text using quantity::text;
alter table public.tool_checklist_items alter column quantity set default '1';
