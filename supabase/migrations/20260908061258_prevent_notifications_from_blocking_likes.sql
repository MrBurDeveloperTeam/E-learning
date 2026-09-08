begin;

-- A secondary notification must never roll back the user's primary action.
-- Any unexpected notification-schema mismatch is recorded in Postgres Logs.
create or replace function community_private.notify_like_safely()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  recipient uuid;
  target_post uuid;
begin
  if tg_table_name = 'community_post_likes' then
    select p.author_id into recipient
    from public.community_posts p
    where p.id = new.post_id;

    if recipient is distinct from new.user_id
       and community_private.notification_enabled(recipient, 'likes') then
      insert into public.community_notifications (
        recipient_id, actor_id, notification_type, post_id, title, action_url
      ) values (
        recipient, new.user_id, 'post_like', new.post_id,
        'New post like', '/community/post/' || new.post_id::text
      );
    end if;
  else
    select c.author_id, c.post_id into recipient, target_post
    from public.community_comments c
    where c.id = new.comment_id;

    if recipient is distinct from new.user_id
       and community_private.notification_enabled(recipient, 'likes') then
      insert into public.community_notifications (
        recipient_id, actor_id, notification_type, comment_id, title, action_url
      ) values (
        recipient, new.user_id, 'comment_like', new.comment_id,
        'New comment like', '/community/post/' || target_post::text
      );
    end if;
  end if;

  return new;
exception
  when others then
    raise warning 'Community like notification failed for table %, row %: [%] %',
      tg_table_name,
      coalesce(to_jsonb(new)->>'post_id', to_jsonb(new)->>'comment_id'),
      sqlstate,
      sqlerrm;
    return new;
end;
$$;

revoke all on function community_private.notify_like_safely()
from public, anon, authenticated;

drop trigger if exists community_notify_post_like on public.community_post_likes;
create trigger community_notify_post_like
after insert on public.community_post_likes
for each row execute function community_private.notify_like_safely();

drop trigger if exists community_notify_comment_like on public.community_comment_likes;
create trigger community_notify_comment_like
after insert on public.community_comment_likes
for each row execute function community_private.notify_like_safely();

commit;
