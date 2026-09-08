create table if not exists public.community_post_views (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  viewed_at timestamp with time zone not null default now(),
  primary key (user_id, post_id)
);

create index if not exists community_post_views_user_viewed_at_idx
  on public.community_post_views (user_id, viewed_at desc);

alter table public.community_post_views enable row level security;

grant select, insert, update, delete on table public.community_post_views to authenticated;

drop policy if exists community_post_views_select_own on public.community_post_views;
create policy community_post_views_select_own
  on public.community_post_views
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists community_post_views_insert_own on public.community_post_views;
create policy community_post_views_insert_own
  on public.community_post_views
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists community_post_views_update_own on public.community_post_views;
create policy community_post_views_update_own
  on public.community_post_views
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists community_post_views_delete_own on public.community_post_views;
create policy community_post_views_delete_own
  on public.community_post_views
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
