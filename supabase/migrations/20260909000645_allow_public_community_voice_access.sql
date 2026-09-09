begin;

-- Realtime authorization below checks the caller's active voice reservation.
-- Repeat these grants and policies here so this corrective migration is safe
-- even when an earlier voice migration was only partially applied.
alter table public.community_voice_participants enable row level security;

grant select on public.community_voice_participants to authenticated;

drop policy if exists community_voice_participants_read_own
  on public.community_voice_participants;
create policy community_voice_participants_read_own
  on public.community_voice_participants
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Public Communities are open to every authenticated user. Private Communities
-- continue to require ownership or an active membership.
create or replace function public.community_join_voice_room(input_community_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room_joined_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join this voice room.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(input_community_id::text, 0));

  if not exists (
    select 1
    from public.communities community
    where community.id = input_community_id
      and community.moderation_status = 'active'
      and (
        community.visibility = 'public'
        or community.owner_id = auth.uid()
        or exists (
          select 1
          from public.community_members member
          where member.community_id = community.id
            and member.user_id = auth.uid()
            and member.membership_status = 'active'
        )
      )
  ) then
    raise exception 'This voice room is unavailable or requires an active Community membership.';
  end if;

  delete from public.community_voice_participants
  where last_seen_at < now() - interval '90 seconds'
     or joined_at < now() - interval '60 minutes';

  delete from public.community_voice_participants
  where user_id = auth.uid();

  if (
    select count(*)
    from public.community_voice_participants
    where community_id = input_community_id
  ) >= 4 then
    raise exception 'This voice room is full (maximum 4 members).';
  end if;

  insert into public.community_voice_participants (
    user_id,
    community_id,
    joined_at,
    last_seen_at
  ) values (
    auth.uid(),
    input_community_id,
    room_joined_at,
    room_joined_at
  );

  return room_joined_at;
end;
$$;

revoke all on function public.community_join_voice_room(uuid) from public, anon;
grant execute on function public.community_join_voice_room(uuid) to authenticated;

create or replace function public.community_can_access_voice_topic(input_topic text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select input_topic ~ '^community-voice:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.communities community
      where community.id::text = replace(input_topic, 'community-voice:', '')
        and community.moderation_status = 'active'
        and (
          community.visibility = 'public'
          or community.owner_id = auth.uid()
          or exists (
            select 1
            from public.community_members member
            where member.community_id = community.id
              and member.user_id = auth.uid()
              and member.membership_status = 'active'
          )
        )
    );
$$;

revoke all on function public.community_can_access_voice_topic(text) from public, anon;
grant execute on function public.community_can_access_voice_topic(text) to authenticated;

-- Recreate the two voice-only Realtime policies as part of this corrective
-- migration. This also repairs projects where the original policy creation was
-- skipped or an older definition is still installed.
drop policy if exists community_voice_realtime_read on realtime.messages;
create policy community_voice_realtime_read on realtime.messages
for select to authenticated using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) ~ '^community-voice-(public|private):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.community_voice_participants participant
    where participant.user_id = (select auth.uid())
      and participant.community_id::text = split_part((select realtime.topic()), ':', 2)
      and participant.last_seen_at >= now() - interval '90 seconds'
      and participant.joined_at >= now() - interval '60 minutes'
  )
);

drop policy if exists community_voice_realtime_write on realtime.messages;
create policy community_voice_realtime_write on realtime.messages
for insert to authenticated with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) ~ '^community-voice-(public|private):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.community_voice_participants participant
    where participant.user_id = (select auth.uid())
      and participant.community_id::text = split_part((select realtime.topic()), ':', 2)
      and participant.last_seen_at >= now() - interval '90 seconds'
      and participant.joined_at >= now() - interval '60 minutes'
  )
);

-- The policies now use the reservation table directly, so the helper is no
-- longer part of the authorization path or exposed as an RPC.
revoke all on function public.community_can_access_voice_topic(text) from authenticated;
drop function public.community_can_access_voice_topic(text);

commit;
