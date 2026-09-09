begin;

create or replace function public.community_delete_own_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to delete a post.'
      using errcode = '42501';
  end if;

  update public.community_posts
  set moderation_status = 'removed',
      updated_at = now()
  where id = p_post_id
    and author_id = current_user_id
    and moderation_status <> 'removed';

  if not found then
    if exists (
      select 1 from public.community_posts post
      where post.id = p_post_id and post.author_id <> current_user_id
    ) then
      raise exception 'Only the post author can delete this post.'
        using errcode = '42501';
    elsif exists (
      select 1 from public.community_posts post where post.id = p_post_id
    ) then
      return;
    else
      raise exception 'Post not found.';
    end if;
  end if;
end;
$$;

revoke all on function public.community_delete_own_post(uuid)
  from public, anon;
grant execute on function public.community_delete_own_post(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
