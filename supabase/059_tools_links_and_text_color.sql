-- 공구 마스터 목록: 특정 공구를 고르면 같이 필요한 다른 공구들을 자동으로
-- 같이 선택해주는 "연결 공구" 기능(예: 용접기 -> 석면포/소방수 분무기),
-- 그리고 공구별로 지정할 수 있는 글씨색(6종 중 택1) 추가.
alter table public.tools add column if not exists linked_tool_ids uuid[] not null default '{}';
alter table public.tools add column if not exists text_color text;
