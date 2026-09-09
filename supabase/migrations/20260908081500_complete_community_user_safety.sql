begin;

create table if not exists public.community_user_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restriction_type text not null check (restriction_type in ('comment_mute', 'community_suspension', 'permanent_ban')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint community_restriction_expiry check (
    (restriction_type = 'permanent_ban' and expires_at is null)
    or (restriction_type <> 'permanent_ban' and expires_at is not null)
  )
);

create index if not exists community_user_restrictions_active_idx
  on public.community_user_restrictions (user_id, restriction_type, expires_at)
  where revoked_at is null;

create table if not exists public.community_safety_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('warning', 'restriction_applied', 'restriction_revoked')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  restriction_id uuid references public.community_user_restrictions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists community_safety_actions_user_idx
  on public.community_safety_actions (user_id, created_at desc);

create table if not exists public.community_comment_revisions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_status text not null,
  previous_body text not null,
  replacement_body text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_comment_revisions_user_idx
  on public.community_comment_revisions (user_id, created_at desc);

alter table public.community_user_restrictions enable row level security;
alter table public.community_safety_actions enable row level security;
alter table public.community_comment_revisions enable row level security;

drop policy if exists community_user_restrictions_admin_read on public.community_user_restrictions;
create policy community_user_restrictions_admin_read on public.community_user_restrictions
for select to authenticated using ((select public.is_admin()));
drop policy if exists community_safety_actions_admin_read on public.community_safety_actions;
create policy community_safety_actions_admin_read on public.community_safety_actions
for select to authenticated using ((select public.is_admin()));
drop policy if exists community_comment_revisions_admin_read on public.community_comment_revisions;
create policy community_comment_revisions_admin_read on public.community_comment_revisions
for select to authenticated using ((select public.is_admin()));

grant select on public.community_user_restrictions, public.community_safety_actions, public.community_comment_revisions to authenticated;

create or replace function public.community_apply_user_restriction(
  input_user_id uuid,
  input_type text,
  input_duration_hours integer,
  input_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  restriction_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if input_type not in ('comment_mute', 'community_suspension', 'permanent_ban') then raise exception 'Invalid restriction type'; end if;
  if char_length(btrim(input_reason)) not between 3 and 1000 then raise exception 'Reason must contain 3 to 1000 characters'; end if;
  if input_type <> 'permanent_ban' and coalesce(input_duration_hours, 0) <= 0 then raise exception 'A positive duration is required'; end if;

  insert into public.community_user_restrictions (user_id, restriction_type, reason, expires_at, created_by)
  values (input_user_id, input_type, btrim(input_reason), case when input_type = 'permanent_ban' then null else now() + make_interval(hours => input_duration_hours) end, auth.uid())
  returning id into restriction_id;

  insert into public.community_safety_actions (user_id, action_type, reason, restriction_id, created_by)
  values (input_user_id, 'restriction_applied', btrim(input_reason), restriction_id, auth.uid());
  return restriction_id;
end;
$$;

create or replace function public.community_warn_user(input_user_id uuid, input_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare action_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if char_length(btrim(input_reason)) not between 3 and 1000 then raise exception 'Reason must contain 3 to 1000 characters'; end if;
  insert into public.community_safety_actions (user_id, action_type, reason, created_by)
  values (input_user_id, 'warning', btrim(input_reason), auth.uid()) returning id into action_id;
  return action_id;
end;
$$;

create or replace function public.community_revoke_user_restriction(input_restriction_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target public.community_user_restrictions;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.community_user_restrictions set revoked_at = now()
  where id = input_restriction_id and revoked_at is null returning * into target;
  if target.id is null then raise exception 'Active restriction not found'; end if;
  insert into public.community_safety_actions (user_id, action_type, reason, restriction_id, created_by)
  values (target.user_id, 'restriction_revoked', 'Restriction revoked by administrator.', target.id, auth.uid());
end;
$$;

create or replace function public.community_record_comment_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.content is distinct from new.content then
    insert into public.community_comment_revisions (comment_id, user_id, previous_status, previous_body, replacement_body)
    values (old.id, old.author_id, old.moderation_status, old.content, new.content);
  end if;
  return new;
end;
$$;

drop trigger if exists community_comments_record_revision on public.community_comments;
create trigger community_comments_record_revision before update of content on public.community_comments
for each row execute function public.community_record_comment_revision();

create or replace function public.community_enforce_user_restriction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid;
begin
  actor := case when tg_table_name = 'community_comments' then new.author_id else new.author_id end;
  if exists (
    select 1 from public.community_user_restrictions r
    where r.user_id = actor and r.revoked_at is null and (r.expires_at is null or r.expires_at > now())
      and (r.restriction_type in ('community_suspension', 'permanent_ban') or (tg_table_name = 'community_comments' and r.restriction_type = 'comment_mute'))
  ) then raise exception 'Your Community account is currently restricted from performing this action.';
  end if;
  return new;
end;
$$;

drop trigger if exists community_comments_enforce_restriction on public.community_comments;
create trigger community_comments_enforce_restriction before insert on public.community_comments
for each row execute function public.community_enforce_user_restriction();
drop trigger if exists community_posts_enforce_restriction on public.community_posts;
create trigger community_posts_enforce_restriction before insert on public.community_posts
for each row execute function public.community_enforce_user_restriction();

revoke all on function public.community_apply_user_restriction(uuid, text, integer, text) from public, anon;
revoke all on function public.community_warn_user(uuid, text) from public, anon;
revoke all on function public.community_revoke_user_restriction(uuid) from public, anon;
grant execute on function public.community_apply_user_restriction(uuid, text, integer, text) to authenticated;
grant execute on function public.community_warn_user(uuid, text) to authenticated;
grant execute on function public.community_revoke_user_restriction(uuid) to authenticated;

commit;
