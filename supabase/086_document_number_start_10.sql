-- 견적번호(Q연도-순번)·발주번호(PO연도-순번)를 해마다 010번부터 시작 (사용자 요청).
-- 이미 매겨진 번호는 그대로 두고, 앞으로 새로 만드는 문서에만 적용된다:
--   다음 번호 = max(그 해 마지막 번호 + 1, 10)
--   예) 올해 아직 없음 → Q2026-010 / 올해 마지막이 Q2026-003 → Q2026-010 / 마지막이 Q2026-015 → Q2026-016
-- 041·047의 채번 함수에서 시작 번호만 바꿈(트리거는 그대로 이 함수를 부름).

create or replace function public.set_quote_number()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.quote_number is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()), 'YYYY');
  select greatest(coalesce(max(substring(quote_number from '-(\d+)$')::int), 0) + 1, 10)
    into next_seq
    from public.quotes
    where quote_number like 'Q' || yr || '-%';
  new.quote_number := 'Q' || yr || '-' || lpad(next_seq::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create or replace function public.set_po_number()
returns trigger as $$
declare
  yr text;
  next_seq int;
begin
  if new.po_number is not null then
    return new;
  end if;
  yr := to_char(coalesce(new.created_at, now()), 'YYYY');
  select greatest(coalesce(max(substring(po_number from '-(\d+)$')::int), 0) + 1, 10)
    into next_seq
    from public.purchase_orders
    where po_number like 'PO' || yr || '-%';
  new.po_number := 'PO' || yr || '-' || lpad(next_seq::text, 3, '0');
  return new;
end;
$$ language plpgsql;
