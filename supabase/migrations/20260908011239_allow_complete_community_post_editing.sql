-- Owners can edit the mutable parts of their Community posts. Identity,
-- destination, audience and moderation fields deliberately remain immutable.
grant update (title, content, edited_at, post_kind)
on table public.community_posts to authenticated;

grant select, insert, delete
on table public.community_post_topics to authenticated;

alter table public.community_post_topics enable row level security;

drop policy if exists community_post_topics_select on public.community_post_topics;
create policy community_post_topics_select
on public.community_post_topics
for select
to authenticated
using (community_private.current_user_can_view_post(post_id));

drop policy if exists community_post_topics_insert on public.community_post_topics;
create policy community_post_topics_insert
on public.community_post_topics
for insert
to authenticated
with check (
  assigned_by = (select auth.uid())
  and exists (
    select 1 from public.community_posts p
    where p.id = post_id and p.author_id = (select auth.uid())
  )
);

drop policy if exists community_post_topics_delete on public.community_post_topics;
create policy community_post_topics_delete
on public.community_post_topics
for delete
to authenticated
using (
  exists (
    select 1 from public.community_posts p
    where p.id = post_id
      and (p.author_id = (select auth.uid()) or (select public.is_admin()))
  )
);

grant select, insert, delete
on table public.community_post_media to authenticated;

alter table public.community_post_media enable row level security;

drop policy if exists community_post_media_select on public.community_post_media;
create policy community_post_media_select
on public.community_post_media
for select
to authenticated
using (community_private.current_user_can_view_post(post_id));

drop policy if exists community_post_media_insert on public.community_post_media;
create policy community_post_media_insert
on public.community_post_media
for insert
to authenticated
with check (
  storage_bucket = 'community-post-media'
  and exists (
    select 1 from public.community_posts p
    where p.id = post_id and p.author_id = (select auth.uid())
  )
);

drop policy if exists community_post_media_delete on public.community_post_media;
create policy community_post_media_delete
on public.community_post_media
for delete
to authenticated
using (
  exists (
    select 1 from public.community_posts p
    where p.id = post_id
      and (p.author_id = (select auth.uid()) or (select public.is_admin()))
  )
);
