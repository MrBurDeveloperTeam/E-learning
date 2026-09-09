alter table public.communities
  add column if not exists announcement text;

alter table public.communities
  drop constraint if exists communities_announcement_length;
alter table public.communities
  add constraint communities_announcement_length
  check (announcement is null or length(announcement) <= 1000);

alter table public.community_members
  add column if not exists membership_role text not null default 'member',
  add column if not exists muted_until timestamp with time zone,
  add column if not exists mute_reason text;

alter table public.community_members
  drop constraint if exists community_members_role_check;
alter table public.community_members
  add constraint community_members_role_check
  check (membership_role in ('member', 'moderator'));

alter table public.community_members
  drop constraint if exists community_members_mute_reason_length;
alter table public.community_members
  add constraint community_members_mute_reason_length
  check (mute_reason is null or length(mute_reason) <= 1000);

create table if not exists public.community_rules (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint community_rules_title_length check (length(btrim(title)) between 2 and 120),
  constraint community_rules_description_length check (description is null or length(description) <= 1000),
  constraint community_rules_position_check check (position between 0 and 19),
  constraint community_rules_title_unique unique (community_id, title)
);

alter table public.community_rules enable row level security;

grant select, insert, update, delete on table public.community_rules to authenticated;
grant update (description, announcement, updated_at) on table public.communities to authenticated;
grant update (membership_status, membership_role, muted_until, mute_reason, updated_at) on table public.community_members to authenticated;

drop policy if exists community_rules_select on public.community_rules;
create policy community_rules_select
on public.community_rules for select to authenticated
using (community_private.current_user_can_view_community(community_id));

drop policy if exists community_rules_insert on public.community_rules;
create policy community_rules_insert
on public.community_rules for insert to authenticated
with check (
  community_private.current_user_can_manage_community(community_id)
  and created_by = (select auth.uid())
);

drop policy if exists community_rules_update on public.community_rules;
create policy community_rules_update
on public.community_rules for update to authenticated
using (community_private.current_user_can_manage_community(community_id))
with check (community_private.current_user_can_manage_community(community_id));

drop policy if exists community_rules_delete on public.community_rules;
create policy community_rules_delete
on public.community_rules for delete to authenticated
using (community_private.current_user_can_manage_community(community_id));

drop policy if exists community_members_manage_update on public.community_members;
create policy community_members_manage_update
on public.community_members for update to authenticated
using (community_private.current_user_can_manage_community(community_id))
with check (community_private.current_user_can_manage_community(community_id));

drop policy if exists community_members_manage_delete on public.community_members;
create policy community_members_manage_delete
on public.community_members for delete to authenticated
using (
  community_private.current_user_can_manage_community(community_id)
  and user_id <> (select auth.uid())
);

create or replace function community_private.reject_muted_community_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $$
declare
  target_community_id uuid;
begin
  if tg_table_name = 'community_posts' then
    target_community_id := new.community_id;
  else
    select p.community_id into target_community_id
    from public.community_posts p
    where p.id = new.post_id;
  end if;

  if target_community_id is not null and exists (
    select 1
    from public.community_members member
    where member.community_id = target_community_id
      and member.user_id = (select auth.uid())
      and member.membership_status = 'active'
      and member.muted_until > now()
  ) then
    raise exception 'You are muted in this community until %.', (
      select member.muted_until
      from public.community_members member
      where member.community_id = target_community_id
        and member.user_id = (select auth.uid())
    ) using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_muted_community_post on public.community_posts;
create trigger reject_muted_community_post
before insert on public.community_posts
for each row execute function community_private.reject_muted_community_contribution();

drop trigger if exists reject_muted_community_comment on public.community_comments;
create trigger reject_muted_community_comment
before insert on public.community_comments
for each row execute function community_private.reject_muted_community_contribution();
