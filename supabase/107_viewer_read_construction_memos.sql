-- 107: 조회 전용(viewer) 계정이 공사 메모를 읽을 수 있게(11/14 전체 점검에서 찾음, 사용자 결정 "네").
--
-- 084 SQL(조회 전용 계정)의 읽기 허용 목록에 공사 메모 표(construction_memos)가 빠져 있어서, 조회 전용 계정으로 보면
-- 공사 관리 → 공사 메모가 비어 보였음(관리자·직원은 정상, 자료는 그대로).
--
-- 기존 자료는 하나도 바꾸지 않음 — 읽기 규칙 한 줄만 추가. 조회 전용 계정은 지금처럼 쓰기·수정·삭제를 할 수 없음
-- (그 규칙은 만들지 않음). 세무사 계정은 그대로 공사 메모를 볼 수 없음. 두 번 실행해도 문제없음.
-- 표·칸을 만들지 않는 SQL이라 백업 화면 "SQL 실행 상태"에는 나오지 않음(084·091과 같음).

drop policy if exists "viewer read construction_memos" on public.construction_memos;
create policy "viewer read construction_memos" on public.construction_memos
  for select using (public.current_user_role() = 'viewer');

-- PostgREST(Supabase API 레이어)가 바뀐 규칙을 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
