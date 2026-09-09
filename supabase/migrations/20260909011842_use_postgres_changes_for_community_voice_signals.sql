begin;

create table if not exists public.community_voice_signals (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  signal_kind text not null check (signal_kind in ('ready', 'offer', 'answer', 'ice', 'mute', 'leave')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists community_voice_signals_room_created_idx
  on public.community_voice_signals (community_id, created_at desc);
create index if not exists community_voice_signals_recipient_created_idx
  on public.community_voice_signals (recipient_id, created_at desc);

alter table public.community_voice_signals enable row level security;
revoke all on public.community_voice_signals from public, anon, authenticated;
grant select on public.community_voice_signals to authenticated;

drop policy if exists community_voice_signals_read_active_room
  on public.community_voice_signals;
create policy community_voice_signals_read_active_room
on public.community_voice_signals
for select
to authenticated
using (
  created_at >= now() - interval '2 minutes'
  and (recipient_id is null or recipient_id = (select auth.uid()) or sender_id = (select auth.uid()))
  and exists (
    select 1
    from public.community_voice_participants participant
    where participant.user_id = (select auth.uid())
      and participant.community_id = community_voice_signals.community_id
      and participant.last_seen_at >= now() - interval '90 seconds'
      and participant.joined_at >= now() - interval '60 minutes'
  )
);

create or replace function public.community_send_voice_signal(
  input_community_id uuid,
  input_recipient_id uuid,
  input_signal_kind text,
  input_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  signal_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to send a voice signal.';
  end if;

  if input_signal_kind not in ('ready', 'offer', 'answer', 'ice', 'mute', 'leave') then
    raise exception 'Unsupported voice signal type.';
  end if;

  if pg_column_size(coalesce(input_payload, '{}'::jsonb)) > 65536 then
    raise exception 'Voice signal payload is too large.';
  end if;

  if not exists (
    select 1
    from public.community_voice_participants participant
    where participant.user_id = auth.uid()
      and participant.community_id = input_community_id
      and participant.last_seen_at >= now() - interval '90 seconds'
      and participant.joined_at >= now() - interval '60 minutes'
  ) then
    raise exception 'Your voice room reservation is missing or expired.';
  end if;

  if input_recipient_id is not null and not exists (
    select 1
    from public.community_voice_participants participant
    where participant.user_id = input_recipient_id
      and participant.community_id = input_community_id
      and participant.last_seen_at >= now() - interval '90 seconds'
      and participant.joined_at >= now() - interval '60 minutes'
  ) then
    raise exception 'The voice signal recipient is not active in this room.';
  end if;

  delete from public.community_voice_signals
  where created_at < now() - interval '2 minutes';

  insert into public.community_voice_signals (
    community_id,
    sender_id,
    recipient_id,
    signal_kind,
    payload
  ) values (
    input_community_id,
    auth.uid(),
    input_recipient_id,
    input_signal_kind,
    coalesce(input_payload, '{}'::jsonb)
  )
  returning id into signal_id;

  return signal_id;
end;
$$;

revoke all on function public.community_send_voice_signal(uuid, uuid, text, jsonb)
  from public, anon;
grant execute on function public.community_send_voice_signal(uuid, uuid, text, jsonb)
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_voice_signals'
  ) then
    alter publication supabase_realtime add table public.community_voice_signals;
  end if;
end;
$$;

commit;
