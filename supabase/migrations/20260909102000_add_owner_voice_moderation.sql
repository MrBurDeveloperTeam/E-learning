begin;

alter table public.community_voice_participants
  add column if not exists is_owner_muted boolean not null default false;

create table if not exists public.community_voice_removals (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  removed_by uuid not null references auth.users(id) on delete cascade,
  removed_until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_voice_removals enable row level security;
revoke all on public.community_voice_removals from public, anon, authenticated;

create or replace function public.community_enforce_voice_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.community_voice_removals
  where community_id = new.community_id
    and user_id = new.user_id
    and removed_until <= now();

  if exists (
    select 1 from public.community_voice_removals removal
    where removal.community_id = new.community_id
      and removal.user_id = new.user_id
      and removal.removed_until > now()
  ) then
    raise exception 'You were removed from this voice room and cannot rejoin yet.';
  end if;
  return new;
end;
$$;

drop trigger if exists community_voice_participants_enforce_removal
  on public.community_voice_participants;
create trigger community_voice_participants_enforce_removal
before insert on public.community_voice_participants
for each row execute function public.community_enforce_voice_removal();

alter table public.community_voice_signals
  drop constraint if exists community_voice_signals_signal_kind_check;
alter table public.community_voice_signals
  add constraint community_voice_signals_signal_kind_check
  check (signal_kind in ('ready', 'offer', 'answer', 'ice', 'mute', 'leave', 'owner_mute', 'owner_unmute', 'owner_remove'));

drop policy if exists community_voice_signals_read_active_room
  on public.community_voice_signals;
create policy community_voice_signals_read_active_room
on public.community_voice_signals
for select
to authenticated
using (
  created_at >= now() - interval '2 minutes'
  and (recipient_id is null or recipient_id = (select auth.uid()) or sender_id = (select auth.uid()))
  and (
    exists (
      select 1
      from public.community_voice_participants participant
      where participant.user_id = (select auth.uid())
        and participant.community_id = community_voice_signals.community_id
        and participant.last_seen_at >= now() - interval '90 seconds'
        and participant.joined_at >= now() - interval '60 minutes'
    )
    or (
      recipient_id = (select auth.uid())
      and signal_kind in ('owner_mute', 'owner_unmute', 'owner_remove')
    )
  )
);

create or replace function public.community_owner_moderate_voice_participant(
  input_community_id uuid,
  input_user_id uuid,
  input_action text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_user_id uuid := auth.uid();
begin
  if owner_user_id is null then
    raise exception 'You must be signed in to manage a voice room.';
  end if;
  if input_action not in ('mute', 'unmute', 'remove') then
    raise exception 'Unsupported voice moderation action.';
  end if;
  if not exists (
    select 1 from public.communities community
    where community.id = input_community_id
      and community.owner_id = owner_user_id
      and community.moderation_status = 'active'
  ) then
    raise exception 'Only the Community owner can manage this voice room.';
  end if;
  if input_user_id = owner_user_id then
    raise exception 'The Community owner cannot moderate their own voice session.';
  end if;
  if not exists (
    select 1 from public.community_voice_participants participant
    where participant.community_id = input_community_id
      and participant.user_id = input_user_id
      and participant.last_seen_at >= now() - interval '90 seconds'
      and participant.joined_at >= now() - interval '60 minutes'
  ) then
    raise exception 'This user is no longer active in the voice room.';
  end if;

  if input_action = 'mute' then
    update public.community_voice_participants
    set is_owner_muted = true
    where community_id = input_community_id and user_id = input_user_id;
  elsif input_action = 'unmute' then
    update public.community_voice_participants
    set is_owner_muted = false
    where community_id = input_community_id and user_id = input_user_id;
  else
    insert into public.community_voice_removals (
      community_id, user_id, removed_by, removed_until
    ) values (
      input_community_id, input_user_id, owner_user_id, now() + interval '60 minutes'
    )
    on conflict (community_id, user_id) do update
      set removed_by = excluded.removed_by,
          removed_until = excluded.removed_until,
          created_at = now();
  end if;

  insert into public.community_voice_signals (
    community_id, sender_id, recipient_id, signal_kind, payload
  ) values (
    input_community_id,
    owner_user_id,
    case when input_action = 'remove' then input_user_id else null end,
    case input_action
      when 'mute' then 'owner_mute'
      when 'unmute' then 'owner_unmute'
      else 'owner_remove'
    end,
    jsonb_build_object('target_user_id', input_user_id)
  );

  if input_action = 'remove' then
    insert into public.community_voice_signals (
      community_id, sender_id, recipient_id, signal_kind, payload
    ) values (input_community_id, input_user_id, null, 'leave', '{}'::jsonb);

    delete from public.community_voice_participants
    where community_id = input_community_id and user_id = input_user_id;
  end if;
end;
$$;

revoke all on function public.community_owner_moderate_voice_participant(uuid, uuid, text)
  from public, anon;
grant execute on function public.community_owner_moderate_voice_participant(uuid, uuid, text)
  to authenticated;

create or replace function public.community_voice_heartbeat_status(input_community_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_muted boolean;
begin
  update public.community_voice_participants
  set last_seen_at = now()
  where user_id = auth.uid()
    and community_id = input_community_id
    and joined_at > now() - interval '60 minutes'
  returning is_owner_muted into owner_muted;

  if not found then
    return jsonb_build_object('active', false, 'owner_muted', false);
  end if;
  return jsonb_build_object('active', true, 'owner_muted', owner_muted);
end;
$$;

revoke all on function public.community_voice_heartbeat_status(uuid) from public, anon;
grant execute on function public.community_voice_heartbeat_status(uuid) to authenticated;

create or replace function public.community_list_voice_participants_v2(input_community_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  is_owner_muted boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    participant.user_id,
    coalesce(profile.full_name, profile.name, 'Community member')::text,
    profile.avatar_url::text,
    participant.joined_at,
    participant.is_owner_muted
  from public.community_voice_participants participant
  join public.communities community on community.id = participant.community_id
  left join public.profiles profile on profile.user_id = participant.user_id
  where participant.community_id = input_community_id
    and participant.last_seen_at >= now() - interval '90 seconds'
    and participant.joined_at >= now() - interval '60 minutes'
    and community.moderation_status = 'active'
    and auth.uid() is not null
    and (
      community.visibility = 'public'
      or community.owner_id = auth.uid()
      or exists (
        select 1 from public.community_members member
        where member.community_id = community.id
          and member.user_id = auth.uid()
          and member.membership_status = 'active'
      )
    )
  order by participant.joined_at;
$$;

revoke all on function public.community_list_voice_participants_v2(uuid) from public, anon;
grant execute on function public.community_list_voice_participants_v2(uuid) to authenticated;

commit;
