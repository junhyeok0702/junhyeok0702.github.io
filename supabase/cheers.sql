-- 작품 응원 저장용 스키마 (기존 votes 테이블과 별개)
-- Supabase 대시보드 > SQL Editor 에서 실행한다. 여러 번 실행해도 기존 행을 지우지 않는다.
-- 작품을 바꾸면 netlify/functions/cheers.mjs 의 WORKS 와 index.html 의 data-work 도 같이 바꾼다.

-- 응원 한 건 = 한 행. 숫자 하나를 덮어쓰지 않고 행을 쌓은 뒤 센다.
create table if not exists public.cheers (
  id         bigint generated always as identity primary key,   -- 고유 번호 (1, 2, 3 …)
  work_id    text not null check (work_id in ('photo-night', 'animation-short', 'poster')),
  created_at timestamptz not null default now()                 -- 저장 시각
);

alter table public.cheers enable row level security;

-- 권한은 필요한 것만: 읽기, 그리고 work_id 컬럼만 쓰기. 수정·삭제는 허용하지 않는다.
revoke all on public.cheers from anon, authenticated;
grant select on public.cheers to anon;
grant insert (work_id) on public.cheers to anon;

drop policy if exists "cheers_select_anon" on public.cheers;
create policy "cheers_select_anon" on public.cheers
  for select to anon using (true);

drop policy if exists "cheers_insert_anon" on public.cheers;
create policy "cheers_insert_anon" on public.cheers
  for insert to anon
  with check (work_id in ('photo-night', 'animation-short', 'poster'));

-- 작품별 누적 응원 횟수와 최근 응원 시각. DB가 세므로 조회 건수 제한에 걸리지 않는다.
create or replace view public.cheer_stats
  with (security_invoker = true) as
  select work_id, count(*)::int as count, max(created_at) as last_at
  from public.cheers
  group by work_id;

revoke all on public.cheer_stats from anon, authenticated;
grant select on public.cheer_stats to anon;
