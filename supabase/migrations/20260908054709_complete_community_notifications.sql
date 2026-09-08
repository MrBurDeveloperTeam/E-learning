begin;

-- Keep the eight switches independent. The original grouped columns remain so
-- older clients can keep working while this release rolls out.
alter table public.community_user_settings
  add column if not exists notify_replies boolean not null default true,
  add column if not exists notify_mentions boolean not null default true,
  add column if not exists notify_community_updates boolean not null default true,
  add column if not exists notify_moderation_updates boolean not null default true;

update public.community_user_settings
set notify_replies = notify_comments,
    notify_mentions = notify_comments,
    notify_community_updates = notify_community_activity,
    notify_moderation_updates = notify_community_activity;

alter table public.community_notifications
  drop constraint if exists community_notifications_type_check;
alter table public.community_notifications
  add constraint community_notifications_type_check check (notification_type in (
    'new_follower', 'friend_request', 'friend_accepted', 'post_like',
    'post_comment', 'comment_reply', 'comment_like', 'post_repost', 'mention',
    'community_join_request', 'community_join_approved', 'community_join_rejected',
    'community_update', 'new_message', 'verification_approved',
    'verification_rejected', 'moderation_action', 'report_resolved', 'appeal_decided'
  ));

create or replace function community_private.notification_enabled(
  target_user_id uuid,
  preference_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select case preference_name
    when 'likes' then coalesce(s.notify_post_likes, true)
    when 'replies' then coalesce(s.notify_replies, true)
    when 'mentions' then coalesce(s.notify_mentions, true)
    when 'follows' then coalesce(s.notify_follows, true)
    when 'friend_requests' then coalesce(s.notify_friend_requests, true)
    when 'community_updates' then coalesce(s.notify_community_updates, true)
    when 'moderation_updates' then coalesce(s.notify_moderation_updates, true)
    when 'direct_messages' then coalesce(s.notify_messages, true)
    else true
  end
  from (select 1) seed
  left join public.community_user_settings s on s.user_id = target_user_id;
$$;

revoke all on function community_private.notification_enabled(uuid, text) from public, anon, authenticated;

create or replace function community_private.notify_community_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  recipient uuid;
  post_owner uuid;
  parent_owner uuid;
  target_post uuid;
  mentioned_username text;
  mentioned_user uuid;
begin
  if tg_table_name = 'community_follows' and tg_op = 'INSERT' then
    if new.follower_id <> new.following_id
       and community_private.notification_enabled(new.following_id, 'follows') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, title, action_url)
      values (new.following_id, new.follower_id, 'new_follower', 'New follower', '/profile/' || new.follower_id::text);
    end if;

  elsif tg_table_name = 'community_friendships' then
    if tg_op = 'INSERT' and new.friendship_status = 'pending'
       and community_private.notification_enabled(new.addressee_id, 'friend_requests') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, friendship_id, title, action_url)
      values (new.addressee_id, new.requester_id, 'friend_request', new.id, 'New friend request', '/community?tab=following');
    elsif tg_op = 'UPDATE' and old.friendship_status is distinct from new.friendship_status
       and new.friendship_status = 'accepted'
       and community_private.notification_enabled(new.requester_id, 'friend_requests') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, friendship_id, title, action_url)
      values (new.requester_id, new.addressee_id, 'friend_accepted', new.id, 'Friend request accepted', '/community?tab=following');
    end if;

  elsif tg_table_name = 'community_post_likes' and tg_op = 'INSERT' then
    select p.author_id into recipient from public.community_posts p where p.id = new.post_id;
    if recipient is distinct from new.user_id
       and community_private.notification_enabled(recipient, 'likes') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, post_id, title, action_url)
      values (recipient, new.user_id, 'post_like', new.post_id, 'New post like', '/community/post/' || new.post_id::text);
    end if;

  elsif tg_table_name = 'community_comment_likes' and tg_op = 'INSERT' then
    select c.author_id, c.post_id into recipient, target_post
    from public.community_comments c where c.id = new.comment_id;
    if recipient is distinct from new.user_id
       and community_private.notification_enabled(recipient, 'likes') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, comment_id, title, action_url)
      values (recipient, new.user_id, 'comment_like', new.comment_id, 'New comment like', '/community/post/' || target_post::text);
    end if;

  elsif tg_table_name = 'community_comments' and tg_op = 'INSERT' then
    select p.author_id into post_owner from public.community_posts p where p.id = new.post_id;
    if new.parent_comment_id is not null then
      select c.author_id into parent_owner from public.community_comments c where c.id = new.parent_comment_id;
      if parent_owner is distinct from new.author_id
         and community_private.notification_enabled(parent_owner, 'replies') then
        insert into public.community_notifications(recipient_id, actor_id, notification_type, comment_id, title, action_url)
        values (parent_owner, new.author_id, 'comment_reply', new.id, 'New reply', '/community/post/' || new.post_id::text);
      end if;
    elsif post_owner is distinct from new.author_id
       and community_private.notification_enabled(post_owner, 'replies') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, comment_id, title, action_url)
      values (post_owner, new.author_id, 'post_comment', new.id, 'New comment', '/community/post/' || new.post_id::text);
    end if;

    for mentioned_username in
      select distinct lower((matched.username_parts)[1])
      from regexp_matches(coalesce(new.content, ''), '@([A-Za-z0-9_.-]+)', 'g')
        as matched(username_parts)
    loop
      select p.user_id into mentioned_user
      from public.profiles p where lower(p.username) = mentioned_username limit 1;
      if mentioned_user is distinct from new.author_id
         and community_private.notification_enabled(mentioned_user, 'mentions') then
        insert into public.community_notifications(recipient_id, actor_id, notification_type, comment_id, title, action_url)
        values (mentioned_user, new.author_id, 'mention', new.id, 'You were mentioned', '/community/post/' || new.post_id::text);
      end if;
    end loop;

  elsif tg_table_name = 'community_join_requests' then
    select c.owner_id into recipient from public.communities c where c.id = new.community_id;
    if tg_op = 'INSERT' and community_private.notification_enabled(recipient, 'community_updates') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, join_request_id, title, action_url)
      values (recipient, new.requester_id, 'community_join_request', new.id, 'New Community join request', '/community/' || (select c.slug from public.communities c where c.id = new.community_id));
    elsif tg_op = 'UPDATE' and old.request_status is distinct from new.request_status
       and new.request_status in ('approved', 'rejected')
       and community_private.notification_enabled(new.requester_id, 'community_updates') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, join_request_id, title, action_url)
      values (new.requester_id, coalesce(new.reviewed_by, recipient),
        case when new.request_status = 'approved' then 'community_join_approved' else 'community_join_rejected' end,
        new.id,
        case when new.request_status = 'approved' then 'Community request approved' else 'Community request declined' end,
        '/community/' || (select c.slug from public.communities c where c.id = new.community_id));
    end if;

  elsif tg_table_name = 'community_messages' and tg_op = 'INSERT' then
    for recipient in
      select cp.user_id from public.community_conversation_participants cp
      where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
    loop
      if community_private.notification_enabled(recipient, 'direct_messages') then
        insert into public.community_notifications(recipient_id, actor_id, notification_type, message_id, title, action_url)
        values (recipient, new.sender_id, 'new_message', new.id, 'New direct message', '/community?tab=chat');
      end if;
    end loop;

  elsif tg_table_name = 'communities' and tg_op = 'UPDATE'
      and old.announcement is distinct from new.announcement and new.announcement is not null then
    for recipient in
      select cm.user_id from public.community_members cm
      where cm.community_id = new.id and cm.membership_status = 'active' and cm.user_id <> new.owner_id
    loop
      if community_private.notification_enabled(recipient, 'community_updates') then
        insert into public.community_notifications(recipient_id, actor_id, notification_type, community_id, title, message, action_url)
        values (recipient, new.owner_id, 'community_update', new.id, new.name || ' announcement', left(new.announcement, 1000), '/community/' || new.slug);
      end if;
    end loop;

  elsif tg_table_name = 'community_posts' and tg_op = 'UPDATE'
      and old.moderation_status is distinct from new.moderation_status
      and new.author_id is distinct from (select auth.uid())
      and community_private.notification_enabled(new.author_id, 'moderation_updates') then
    insert into public.community_notifications(recipient_id, actor_id, notification_type, post_id, title, action_url)
    values (new.author_id, (select auth.uid()), 'moderation_action', new.id, 'Your Community post was reviewed', '/community/post/' || new.id::text);

  elsif tg_table_name = 'community_reports' and tg_op = 'UPDATE'
      and old.report_status is distinct from new.report_status
      and new.report_status in ('resolved', 'dismissed')
      and community_private.notification_enabled(new.reporter_id, 'moderation_updates') then
    insert into public.community_notifications(recipient_id, actor_id, notification_type, report_id, title, action_url)
    values (new.reporter_id, nullif((select auth.uid()), new.reporter_id), 'report_resolved', new.id, 'Your Community report was reviewed', '/community?tab=settings');

  elsif tg_table_name = 'community_appeals' and tg_op = 'UPDATE'
      and old.status is distinct from new.status
      and new.status in ('approved', 'rejected')
      and community_private.notification_enabled(new.appellant_id, 'moderation_updates') then
    insert into public.community_notifications(recipient_id, actor_id, notification_type, community_id, title, action_url)
    values (new.appellant_id, nullif(new.reviewed_by, new.appellant_id), 'appeal_decided', new.community_id, 'Your Community appeal was reviewed', '/community?tab=settings');
  end if;
  return new;
end;
$$;

revoke all on function community_private.notify_community_event() from public, anon, authenticated;

create or replace function community_private.notify_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  mentioned_username text;
  mentioned_user uuid;
begin
  for mentioned_username in
    select distinct lower((matched.username_parts)[1])
    from regexp_matches(
      coalesce(new.title, '') || ' ' || coalesce(new.content, ''),
      '@([A-Za-z0-9_.-]+)',
      'g'
    ) as matched(username_parts)
  loop
    select p.user_id into mentioned_user
    from public.profiles p where lower(p.username) = mentioned_username limit 1;
    if mentioned_user is distinct from new.author_id
       and community_private.notification_enabled(mentioned_user, 'mentions') then
      insert into public.community_notifications(recipient_id, actor_id, notification_type, post_id, title, action_url)
      values (mentioned_user, new.author_id, 'mention', new.id, 'You were mentioned', '/community/post/' || new.id::text);
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function community_private.notify_post_mentions() from public, anon, authenticated;

drop trigger if exists community_notify_follow on public.community_follows;
create trigger community_notify_follow after insert on public.community_follows
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_friendship on public.community_friendships;
create trigger community_notify_friendship after insert or update of friendship_status on public.community_friendships
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_post_like on public.community_post_likes;
create trigger community_notify_post_like after insert on public.community_post_likes
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_comment_like on public.community_comment_likes;
create trigger community_notify_comment_like after insert on public.community_comment_likes
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_comment on public.community_comments;
create trigger community_notify_comment after insert on public.community_comments
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_join_request on public.community_join_requests;
create trigger community_notify_join_request after insert or update of request_status on public.community_join_requests
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_message on public.community_messages;
create trigger community_notify_message after insert on public.community_messages
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_announcement on public.communities;
create trigger community_notify_announcement after update of announcement on public.communities
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_post_moderation on public.community_posts;
create trigger community_notify_post_moderation after update of moderation_status on public.community_posts
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_post_mentions on public.community_posts;
create trigger community_notify_post_mentions after insert on public.community_posts
for each row execute function community_private.notify_post_mentions();
drop trigger if exists community_notify_report_resolution on public.community_reports;
create trigger community_notify_report_resolution after update of report_status on public.community_reports
for each row execute function community_private.notify_community_event();
drop trigger if exists community_notify_appeal_decision on public.community_appeals;
create trigger community_notify_appeal_decision after update of status on public.community_appeals
for each row execute function community_private.notify_community_event();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'community_notifications'
  ) then
    alter publication supabase_realtime add table public.community_notifications;
  end if;
end $$;

commit;
