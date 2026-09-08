begin;

create table if not exists public.community_voice_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists community_voice_participants_room_idx
  on public.community_voice_participants (community_id, last_seen_at);

alter table public.community_voice_participants enable row level security;

drop policy if exists community_voice_participants_read_own on public.community_voice_participants;
create policy community_voice_participants_read_own on public.community_voice_participants
for select to authenticated using (user_id = (select auth.uid()));

grant select on public.community_voice_participants to authenticated;

create or replace function public.community_join_voice_room(input_community_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room_joined_at timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(input_community_id::text, 0));
  if not exists (
    select 1 from public.communities c
    where c.id = input_community_id and c.moderation_status = 'active'
      and (c.owner_id = auth.uid() or exists (
        select 1 from public.community_members m
        where m.community_id = c.id and m.user_id = auth.uid() and m.membership_status = 'active'
      ))
  ) then
    raise exception 'You must be an active Community member to join this voice room.';
  end if;

  delete from public.community_voice_participants
  where last_seen_at < now() - interval '90 seconds'
     or joined_at < now() - interval '60 minutes';
  delete from public.community_voice_participants where user_id = auth.uid();

  if (select count(*) from public.community_voice_participants where community_id = input_community_id) >= 4 then
    raise exception 'This voice room is full (maximum 4 members).';
  end if;

  insert into public.community_voice_participants (user_id, community_id, joined_at, last_seen_at)
  values (auth.uid(), input_community_id, room_joined_at, room_joined_at);
  return room_joined_at;
end;
$$;

create or replace function public.community_voice_heartbeat(input_community_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.community_voice_participants set last_seen_at = now()
  where user_id = auth.uid() and community_id = input_community_id
    and joined_at > now() - interval '60 minutes';
  return found;
end;
$$;

create or replace function public.community_leave_voice_room(input_community_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.community_voice_participants
  where user_id = auth.uid() and community_id = input_community_id;
$$;

revoke all on function public.community_join_voice_room(uuid) from public, anon;
revoke all on function public.community_voice_heartbeat(uuid) from public, anon;
revoke all on function public.community_leave_voice_room(uuid) from public, anon;
grant execute on function public.community_join_voice_room(uuid) to authenticated;
grant execute on function public.community_voice_heartbeat(uuid) to authenticated;
grant execute on function public.community_leave_voice_room(uuid) to authenticated;

create or replace function public.community_can_access_voice_topic(input_topic text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select input_topic like 'community-voice:%'
    and exists (
      select 1 from public.community_voice_participants participant
      where participant.user_id = auth.uid()
        and participant.community_id::text = replace(input_topic, 'community-voice:', '')
        and participant.last_seen_at >= now() - interval '90 seconds'
        and participant.joined_at >= now() - interval '60 minutes'
    );
$$;

revoke all on function public.community_can_access_voice_topic(text) from public, anon;
grant execute on function public.community_can_access_voice_topic(text) to authenticated;

drop policy if exists community_voice_realtime_read on realtime.messages;
create policy community_voice_realtime_read on realtime.messages
for select to authenticated using (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.community_can_access_voice_topic((select realtime.topic()))
);

drop policy if exists community_voice_realtime_write on realtime.messages;
create policy community_voice_realtime_write on realtime.messages
for insert to authenticated with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.community_can_access_voice_topic((select realtime.topic()))
);

commit;
