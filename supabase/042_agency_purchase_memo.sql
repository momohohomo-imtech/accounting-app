-- 대행구매 품목에 메모(무슨 물품인지, 무슨 사항인지 등 자유 텍스트) 추가.
alter table public.project_agency_purchases
  add column if not exists memo text;
