-- 100: 공사 작업 순서 — 팀(분업) 색(11/2 사용자 결정 "순서표마다" + "같은 팀 일정 겹침 알림"). 098·099 다음에 실행할 것.
-- 칸 2개만 추가 — 기존 자료는 그대로(팀 목록은 빈 목록, 단계는 팀 미정 = 예전처럼 남색 막대). 두 번 실행해도 문제없음.
--
-- work_sequences.teams: 이 순서표의 팀 목록 [{ "id": "...", "name": "설비팀", "color": "orange" }, ...] — 순서표마다 따로(복사하면
--                       같이 복사). 색은 앱의 정해진 색 이름(blue·orange·aqua·yellow·magenta·green·violet, lib/workSequence.ts).
-- work_sequence_steps.team_id: 그 단계를 맡은 팀(위 목록의 id). 비어 있으면 팀 미정. 목록에서 팀을 지우면 앱이 저장할 때 같이
--                       비움(목록에 없는 id는 앱이 팀 미정으로 봄).
-- 백업은 칸을 자동으로 담고, 이 칸이 없던 예전 백업을 복원하면 기본값(빈 팀 목록·팀 미정).

alter table public.work_sequences
  add column if not exists teams jsonb not null default '[]'::jsonb;
alter table public.work_sequence_steps
  add column if not exists team_id text;

-- 팀 목록은 늘 배열(앱이 아닌 곳에서 잘못 넣는 것 막기)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_sequences_teams_is_array') then
    alter table public.work_sequences
      add constraint work_sequences_teams_is_array check (jsonb_typeof(teams) = 'array');
  end if;
end $$;

-- PostgREST(Supabase API 레이어)가 새 칸을 바로 알도록 스키마를 다시 읽게 함.
notify pgrst, 'reload schema';
