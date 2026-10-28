-- 1) 백업 기록에 표별 줄 수 칸 — 백업 화면·대시보드에 "백업에 담긴 거래 수"를 보여 주고, 표마다 끝까지 담은 새 방식 백업인지
--    구별한다(예전 백업은 표마다 1,000줄까지만 담겼음). 앱은 이 칸이 없어도 백업이 되게 만들어 둠 — 실행 전 백업은 줄 수 없이
--    기록되고, 백업 파일 안에는 줄 수가 늘 들어 있음.
-- 2) 거래 수정 이력(094)에서 영수증 인식 원문(ocr_extracted_raw)은 빼고 남긴다 — 영수증을 읽은 긴 원문이 고칠 때마다 전·후로
--    통째로 쌓여 이력 표가 빨리 커졌음. 화면에 보이는 칸은 그대로 다 남고, 원문만 바뀐 수정은 남기지 않음.
--    094를 실행한 뒤에 실행할 것(094보다 먼저 실행했다면 094 실행 후 이 파일을 한 번 더 실행).
-- 저장된 거래·백업 데이터는 바꾸지 않음 — 칸 하나 추가와 기록용 함수 교체만. 두 번 실행해도 문제없음.

alter table public.backups add column if not exists row_counts jsonb;

-- security definer: 거래를 고친 사람의 권한과 상관없이 이력 표에 쓸 수 있게(이력 표에는 쓰기 정책이 없음).
-- changed_by = 고친 사람(auth.uid()) — 백업 화면에서 한 복원도 복원한 관리자로 남음(복원은 거래를 전부 지우고 다시 넣어서
-- 거래 수만큼 "삭제"가 남고, 화면에서는 한 줄로 접어 보여 줌). Supabase SQL 편집기처럼 로그인 없이 바꾸면 비어 있음.
create or replace function public.log_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old) - 'ocr_extracted_raw';
  v_new jsonb;
begin
  if tg_op = 'UPDATE' then
    v_new := to_jsonb(new) - 'ocr_extracted_raw';
    if v_new = v_old then
      return new; -- 바뀐 것이 없으면(원문만 바뀐 경우 포함) 안 남김
    end if;
    insert into public.transaction_history (transaction_id, action, changed_by, old_row, new_row)
    values (old.id, 'update', auth.uid(), v_old, v_new);
    return new;
  end if;
  insert into public.transaction_history (transaction_id, action, changed_by, old_row)
  values (old.id, 'delete', auth.uid(), v_old);
  return old;
end;
$$;

-- PostgREST(Supabase API 레이어)가 새 칸을 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
