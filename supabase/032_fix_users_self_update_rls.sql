-- 보안 수정: "self update users" 정책에 WITH CHECK가 없어서, 로그인한 사용자 누구나
-- 자기 자신의 users 행을 자유롭게 수정할 수 있었다 (role을 'admin'으로 바꾸거나,
-- 세무사 계정의 resuspend_at 예약을 스스로 지우는 것도 가능했음).
-- 앱 코드에서는 users 테이블 UPDATE를 전부 서비스 롤(관리자 클라이언트)로만 하고 있어서
-- 이 정책은 실제로 쓰이는 곳이 없다 — 그냥 제거한다.
drop policy if exists "self update users" on public.users;
