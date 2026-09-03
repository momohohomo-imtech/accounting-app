-- 공구별 "기본 수량" — 새 공구명세서 작성 시 그 공구 칸에 자동으로 채워질 값
-- (예: "1", "기본" 등 자유 텍스트). 수정 화면에서 지정, 비워두면 자동 기입 없음.
alter table public.tools add column if not exists default_quantity text;
