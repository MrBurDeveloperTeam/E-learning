create or replace function public.community_search_joinable(search_text text)
returns table (community_id uuid, community_name text, community_slug text, community_description text, community_visibility text, member_count bigint, viewer_is_member boolean)
language sql stable security definer set search_path = '' set row_security = off
as $$
  select c.id, c.name, c.slug, c.description, c.visibility,
    (select count(*) from public.community_members m where m.community_id = c.id and m.membership_status = 'active')
      + case when exists (select 1 from public.community_members om where om.community_id = c.id and om.user_id = c.owner_id and om.membership_status = 'active') then 0 else 1 end,
    c.owner_id = auth.uid() or exists (select 1 from public.community_members vm where vm.community_id = c.id and vm.user_id = auth.uid() and vm.membership_status = 'active')
  from public.communities c
  where c.moderation_status = 'active' and length(btrim(search_text)) >= 2 and position(lower(btrim(search_text)) in lower(c.name)) > 0
  order by case when lower(c.name) = lower(btrim(search_text)) then 0 else 1 end, c.name
  limit 20;
$$;

create or replace function public.community_browse(target_visibility text)
returns table (community_id uuid, community_name text, community_slug text, community_description text, community_visibility text, member_count bigint, viewer_is_member boolean)
language sql volatile security definer set search_path = '' set row_security = off
as $$
  select c.id, c.name, c.slug, c.description, c.visibility,
    (select count(*) from public.community_members m where m.community_id = c.id and m.membership_status = 'active')
      + case when exists (select 1 from public.community_members om where om.community_id = c.id and om.user_id = c.owner_id and om.membership_status = 'active') then 0 else 1 end,
    c.owner_id = auth.uid() or exists (select 1 from public.community_members vm where vm.community_id = c.id and vm.user_id = auth.uid() and vm.membership_status = 'active')
  from public.communities c
  where c.moderation_status = 'active' and c.visibility = target_visibility and target_visibility in ('public', 'private')
  order by random()
  limit 20;
$$;

revoke all on function public.community_search_joinable(text) from public;
revoke all on function public.community_browse(text) from public;
grant execute on function public.community_search_joinable(text) to authenticated;
grant execute on function public.community_browse(text) to authenticated;
