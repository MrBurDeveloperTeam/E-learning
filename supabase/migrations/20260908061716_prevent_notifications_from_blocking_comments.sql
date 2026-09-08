begin;

-- Comment/reply/mention notifications are secondary effects. If the
-- notification schema rejects a row, preserve the comment and log the cause.
create or replace function community_private.notify_comment_safely()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  post_owner uuid;
  parent_owner uuid;
  mentioned_username text;
  mentioned_user uuid;
begin
  select p.author_id into post_owner
  from public.community_posts p
  where p.id = new.post_id;

  if new.parent_comment_id is not null then
    select c.author_id into parent_owner
    from public.community_comments c
    where c.id = new.parent_comment_id;

    if parent_owner is distinct from new.author_id
       and community_private.notification_enabled(parent_owner, 'replies') then
      insert into public.community_notifications (
        recipient_id, actor_id, notification_type, comment_id, title, action_url
      ) values (
        parent_owner, new.author_id, 'comment_reply', new.id,
        'New reply', '/community/post/' || new.post_id::text
      );
    end if;
  elsif post_owner is distinct from new.author_id
     and community_private.notification_enabled(post_owner, 'replies') then
    insert into public.community_notifications (
      recipient_id, actor_id, notification_type, comment_id, title, action_url
    ) values (
      post_owner, new.author_id, 'post_comment', new.id,
      'New comment', '/community/post/' || new.post_id::text
    );
  end if;

  for mentioned_username in
    select distinct lower((matched.username_parts)[1])
    from regexp_matches(
      coalesce(new.content, ''),
      '@([A-Za-z0-9_.-]+)',
      'g'
    ) as matched(username_parts)
  loop
    select p.user_id into mentioned_user
    from public.profiles p
    where lower(p.username) = mentioned_username
    limit 1;

    if mentioned_user is distinct from new.author_id
       and community_private.notification_enabled(mentioned_user, 'mentions') then
      insert into public.community_notifications (
        recipient_id, actor_id, notification_type, comment_id, title, action_url
      ) values (
        mentioned_user, new.author_id, 'mention', new.id,
        'You were mentioned', '/community/post/' || new.post_id::text
      );
    end if;
  end loop;

  return new;
exception
  when others then
    raise warning 'Community comment notification failed for comment %: [%] %',
      new.id,
      sqlstate,
      sqlerrm;
    return new;
end;
$$;

revoke all on function community_private.notify_comment_safely()
from public, anon, authenticated;

drop trigger if exists community_notify_comment on public.community_comments;
create trigger community_notify_comment
after insert on public.community_comments
for each row execute function community_private.notify_comment_safely();

commit;
