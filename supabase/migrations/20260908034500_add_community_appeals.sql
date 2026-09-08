create table if not exists public.community_appeals (
  id uuid primary key default gen_random_uuid(),
  appellant_id uuid not null references public.profiles(user_id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  post_id uuid,
  comment_id uuid,
  moderation_action_id uuid,
  target_label text,
  reason text not null check (length(btrim(reason)) between 20 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  decision_note text,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists community_appeals_one_pending_community
  on public.community_appeals (appellant_id, community_id)
  where status = 'pending' and community_id is not null;

alter table public.community_appeals enable row level security;

drop policy if exists community_appeals_select on public.community_appeals;
create policy community_appeals_select on public.community_appeals
  for select to authenticated
  using (appellant_id = auth.uid() or public.is_admin());

grant select on public.community_appeals to authenticated;

create or replace function public.community_submit_appeal(
  target_community_id uuid,
  appeal_reason text,
  appeal_target_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  created_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if length(btrim(appeal_reason)) not between 20 and 2000 then raise exception 'Appeal reason must contain 20 to 2,000 characters.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.communities c
    where c.id = target_community_id
      and c.owner_id = current_user_id
      and c.moderation_status in ('rejected', 'hidden')
  ) then raise exception 'This Community is not eligible for an appeal.' using errcode = '42501'; end if;

  insert into public.community_appeals (appellant_id, community_id, target_label, reason)
  values (current_user_id, target_community_id, nullif(btrim(appeal_target_label), ''), btrim(appeal_reason))
  returning id into created_id;
  return created_id;
exception when unique_violation then
  raise exception 'A pending appeal already exists for this Community.' using errcode = '23505';
end;
$$;

create or replace function public.community_withdraw_appeal(target_appeal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  update public.community_appeals
  set status = 'withdrawn', updated_at = now()
  where id = target_appeal_id and appellant_id = auth.uid() and status = 'pending';
  if not found then raise exception 'This pending appeal was not found.' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.community_submit_appeal(uuid, text, text) from public;
revoke all on function public.community_withdraw_appeal(uuid) from public;
grant execute on function public.community_submit_appeal(uuid, text, text) to authenticated;
grant execute on function public.community_withdraw_appeal(uuid) to authenticated;
