-- 109 보안 보완(11/26 보안 점검 — 사용자 결정 "네"). 저장된 자료는 하나도 바뀌지 않음(기본값·읽기 규칙만). 두 번 실행해도 됨.
--
-- ① 새로 생기는 계정의 기본 역할을 'pending'(권한 없음)으로 — 예전엔 019 SQL대로 'staff'(직원)라서, Supabase의 "새 사용자 가입
--    허용"이 켜져 있으면 앱에 들어 있는 공개 주소·키로 스스로 가입한 사람이 바로 직원 권한(모든 자료 읽기·쓰기)을 얻었음.
--    'pending'은 어떤 표의 규칙에도 없는 역할이라 아무것도 못 읽고 못 쓰고, 앱은 로그인을 끊고 "권한이 지정되지 않은 계정"으로 안내함.
--    앱의 계정 관리 "계정 추가"는 만든 뒤 고른 역할로 바로 바꾸므로 그대로 씀. 지금 있는 계정의 역할은 그대로.
alter table public.users alter column role set default 'pending';

-- ② 계정 목록(users 표) 읽기: 본인 줄 + 관리자만 — 예전엔 로그인한 누구나(세무사·조회 전용 포함) 모든 계정의 이메일·이름·역할을 읽을 수
--    있었음. 앱은 본인 역할 확인(본인 줄)과 계정 관리(관리자 — 전체 목록)에서만 이 표를 읽음.
drop policy if exists "authenticated read users" on public.users;
drop policy if exists "self or admin read users" on public.users;
create policy "self or admin read users" on public.users
  for select using (id = auth.uid() or public.current_user_role() = 'admin');

-- ③ 세무사 계정의 프로젝트 대행구매 읽기 빼기 — 055 SQL에서 세무사에게 대시보드를 열어 줄 때 넣은 권한인데, 지금 세무사는 매입매출장과
--    세무사 열람만 보고 두 화면 모두 이 표를 쓰지 않음(필요한 만큼만 열어 두기). 프로젝트 이름 읽기(052)는 매입매출장에 필요해서 그대로.
drop policy if exists "tax_agent read project_agency_purchases" on public.project_agency_purchases;
