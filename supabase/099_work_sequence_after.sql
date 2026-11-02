-- 099: 공사 작업 순서 — 앞 작업 지정(11/2 사용자 요청 "1-4번 진행" 중 4번 "동시에 여러 작업"). 098을 먼저 실행할 것.
-- work_sequence_steps에 칸 2개만 추가 — 기존 자료는 그대로(빈칸 = 지금처럼 바로 앞 단계 뒤에). 두 번 실행해도 문제없음.
--
-- after_step_id: 이 단계가 이어 붙는 앞 작업(같은 순서표의 다른 단계). 비어 있으면 바로 앞 순번 단계. 그 단계를 지우면 빈칸으로
--                (= 바로 앞 단계 뒤로). 앞 순번만 고를 수 있고, 순번을 바꿔 뒤로 간 단계를 가리키면 앱이 바로 앞 단계 기준으로 계산하고
--                알림(lib/workSequence.ts — 서로 물려 끝없이 도는 일이 없게).
-- after_start:   true면 순서표 시작에 같이 시작("처음부터" — 앞 작업·겹침을 쓰지 않음).
-- 단계 날짜는 여전히 저장하지 않고 앱이 계산. 백업은 칸을 자동으로 담고, 이 칸이 없던 예전 백업을 복원하면 빈칸(바로 앞 단계 뒤).

alter table public.work_sequence_steps
  add column if not exists after_step_id uuid references public.work_sequence_steps(id) on delete set null;
alter table public.work_sequence_steps
  add column if not exists after_start boolean not null default false;

-- PostgREST(Supabase API 레이어)가 새 칸을 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
