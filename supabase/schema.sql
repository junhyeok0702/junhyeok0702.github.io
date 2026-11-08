-- 다음 그림 주제 반응 저장용 스키마
-- Supabase 대시보드 > SQL Editor 에서 한 번 실행한다.
-- 주제를 바꾸면 netlify/functions/votes.mjs 의 TOPICS 도 같이 바꾼다.

create table if not exists public.votes (
  id         uuid primary key default gen_random_uuid(),
  topic      text not null check (topic in ('풍경', '인물', '정물', '추상')),
  created_at timestamptz not null default now()
);

alter table public.votes enable row level security;

-- 권한은 필요한 것만: 읽기, 그리고 topic 컬럼만 쓰기. 수정·삭제는 허용하지 않는다.
revoke all on public.votes from anon, authenticated;
grant select on public.votes to anon;
grant insert (topic) on public.votes to anon;

drop policy if exists "votes_select_anon" on public.votes;
create policy "votes_select_anon" on public.votes
  for select to anon using (true);

drop policy if exists "votes_insert_anon" on public.votes;
create policy "votes_insert_anon" on public.votes
  for insert to anon
  with check (topic in ('풍경', '인물', '정물', '추상'));

-- 주제별 횟수. security_invoker 로 호출한 사용자 권한(RLS)을 그대로 따른다.
create or replace view public.vote_counts
  with (security_invoker = true) as
  select topic, count(*)::int as count
  from public.votes
  group by topic;

grant select on public.vote_counts to anon;
