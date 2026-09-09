create or replace function public.community_review_join_request(
  target_request_id uuid,
  target_decision text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  request_row record;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if target_decision not in ('approved', 'rejected') then
    raise exception 'The join-request decision is invalid.' using errcode = '22023';
  end if;

  select
    request.id,
    request.community_id,
    request.requester_id,
    request.request_status,
    community.owner_id,
    community.moderation_status
  into request_row
  from public.community_join_requests as request
  join public.communities as community on community.id = request.community_id
  where request.id = target_request_id
  for update of request;

  if not found then
    raise exception 'The join request was not found.' using errcode = 'P0002';
  end if;

  if request_row.owner_id <> current_user_id and not public.is_admin() then
    raise exception 'Only the Community owner can review this request.' using errcode = '42501';
  end if;

  if request_row.request_status <> 'pending' then
    raise exception 'This join request has already been reviewed.' using errcode = '22023';
  end if;

  if request_row.moderation_status <> 'active' then
    raise exception 'This Community is not accepting join requests.' using errcode = '22023';
  end if;

  if target_decision = 'approved' then
    insert into public.community_members (
      community_id,
      user_id,
      membership_status,
      joined_at,
      updated_at
    ) values (
      request_row.community_id,
      request_row.requester_id,
      'active',
      now(),
      now()
    )
    on conflict (community_id, user_id) do update
      set membership_status = 'active',
          joined_at = now(),
          updated_at = now()
      where public.community_members.membership_status <> 'banned';

    if not found then
      raise exception 'A banned member cannot be approved.' using errcode = '42501';
    end if;
  end if;

  update public.community_join_requests
  set request_status = target_decision,
      reviewed_by = current_user_id,
      reviewed_at = now(),
      updated_at = now()
  where id = target_request_id;
end;
$$;

revoke all on function public.community_review_join_request(uuid, text) from public;
grant execute on function public.community_review_join_request(uuid, text) to authenticated;

create or replace function public.community_invite_preview(target_slug text)
returns table (
  community_name text,
  community_slug text,
  community_visibility text
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select c.name, c.slug, c.visibility
  from public.communities as c
  where c.slug = lower(btrim(target_slug))
    and c.moderation_status = 'active'
  limit 1;
$$;

revoke all on function public.community_invite_preview(text) from public;
grant execute on function public.community_invite_preview(text) to authenticated;

create or replace function public.community_search_joinable(search_text text)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_visibility text,
  member_count bigint,
  viewer_is_member boolean
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.description,
    c.visibility,
    (select count(*) from public.community_members m where m.community_id = c.id and m.membership_status = 'active') + case when exists (select 1 from public.community_members owner_member where owner_member.community_id = c.id and owner_member.user_id = c.owner_id and owner_member.membership_status = 'active') then 0 else 1 end,
    c.owner_id = auth.uid() or exists (
      select 1 from public.community_members own_membership
      where own_membership.community_id = c.id
        and own_membership.user_id = auth.uid()
        and own_membership.membership_status = 'active'
    )
  from public.communities c
  where c.moderation_status = 'active'
    and length(btrim(search_text)) >= 2
    and position(lower(btrim(search_text)) in lower(c.name)) > 0
  order by
    case when lower(c.name) = lower(btrim(search_text)) then 0 else 1 end,
    c.name
  limit 20;
$$;

revoke all on function public.community_search_joinable(text) from public;
grant execute on function public.community_search_joinable(text) to authenticated;

create or replace function public.community_browse(target_visibility text)
returns table (
  community_id uuid,
  community_name text,
  community_slug text,
  community_description text,
  community_visibility text,
  member_count bigint,
  viewer_is_member boolean
)
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.description,
    c.visibility,
    (select count(*) from public.community_members m where m.community_id = c.id and m.membership_status = 'active') + case when exists (select 1 from public.community_members owner_member where owner_member.community_id = c.id and owner_member.user_id = c.owner_id and owner_member.membership_status = 'active') then 0 else 1 end,
    c.owner_id = auth.uid() or exists (
      select 1 from public.community_members own_membership
      where own_membership.community_id = c.id
        and own_membership.user_id = auth.uid()
        and own_membership.membership_status = 'active'
    )
  from public.communities c
  where c.moderation_status = 'active'
    and c.visibility = target_visibility
    and target_visibility in ('public', 'private')
  order by random()
  limit 20;
$$;

revoke all on function public.community_browse(text) from public;
grant execute on function public.community_browse(text) to authenticated;
