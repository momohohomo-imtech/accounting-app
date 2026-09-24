-- 메모장 구분(회사·프로젝트·제작·현장·기타). 고정 목록 — 바꾸려면 이 제약과
-- app/src/lib/memoCategories.ts를 같이 고칠 것.
-- 기존 메모는 비어 있는 채로(= 화면에서 "미분류") 둔다 — 저장된 제목·내용은 바뀌지 않음.
alter table public.memos add column if not exists category text;

alter table public.memos drop constraint if exists memos_category_check;
alter table public.memos add constraint memos_category_check
  check (category is null or category in ('회사', '프로젝트', '제작', '현장', '기타'));
