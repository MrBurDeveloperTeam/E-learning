grant update (moderation_status, updated_at) on table public.communities to authenticated;

create or replace function community_private.current_user_can_view_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.communities c
      where c.id = target_community_id
        and (
          (select public.is_admin())
          or c.owner_id = (select auth.uid())
          or (
            c.moderation_status = 'active'
            and (
              c.visibility = 'public'
              or exists (
                select 1 from public.community_members m
                where m.community_id = c.id
                  and m.user_id = (select auth.uid())
                  and m.membership_status = 'active'
              )
            )
          )
          or (
            c.moderation_status = 'archived'
            and exists (
              select 1 from public.community_members m
              where m.community_id = c.id
                and m.user_id = (select auth.uid())
                and m.membership_status = 'active'
            )
          )
        )
    );
$function$;

create or replace function community_private.reject_archived_community_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  target_id uuid;
  record_id uuid;
begin
  if tg_argv[0] = 'community' then
    target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  elsif tg_argv[0] = 'community_id' then
    target_id := case when tg_op = 'DELETE' then old.community_id else new.community_id end;
  elsif tg_argv[0] = 'post_id' then
    record_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
    select p.community_id into target_id from public.community_posts p where p.id = record_id;
  elsif tg_argv[0] = 'comment_id' then
    record_id := case when tg_op = 'DELETE' then old.comment_id else new.comment_id end;
    select p.community_id into target_id
    from public.community_comments c
    join public.community_posts p on p.id = c.post_id
    where c.id = record_id;
  end if;

  if target_id is not null and exists (
    select 1 from public.communities c
    where c.id = target_id and c.moderation_status = 'archived'
  ) then
    raise exception 'This Community was deleted by its owner and is read-only.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists communities_archived_read_only on public.communities;
create trigger communities_archived_read_only
before update or delete on public.communities
for each row
when (old.moderation_status = 'archived')
execute function community_private.reject_archived_community_mutation('community');

do $migration$
declare
  spec text[];
  trigger_name text;
  table_name text;
  lookup_kind text;
begin
  foreach spec slice 1 in array array[
    array['community_members_archived_read_only','community_members','community_id'],
    array['community_join_requests_archived_read_only','community_join_requests','community_id'],
    array['community_rules_archived_read_only','community_rules','community_id'],
    array['community_posts_archived_read_only','community_posts','community_id'],
    array['community_post_topics_archived_read_only','community_post_topics','post_id'],
    array['community_post_media_archived_read_only','community_post_media','post_id'],
    array['community_post_likes_archived_read_only','community_post_likes','post_id'],
    array['community_post_bookmarks_archived_read_only','community_post_bookmarks','post_id'],
    array['community_post_reposts_archived_read_only','community_post_reposts','post_id'],
    array['community_comments_archived_read_only','community_comments','post_id'],
    array['community_comment_likes_archived_read_only','community_comment_likes','comment_id'],
    array['community_comment_media_archived_read_only','community_comment_media','comment_id']
  ] loop
    trigger_name := spec[1]; table_name := spec[2]; lookup_kind := spec[3];
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists %I on public.%I', trigger_name, table_name);
      execute format(
        'create trigger %I before insert or update or delete on public.%I for each row execute function community_private.reject_archived_community_mutation(%L)',
        trigger_name, table_name, lookup_kind
      );
    end if;
  end loop;
end
$migration$;

create or replace function community_private.reject_archived_community_storage_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  object_bucket text;
  object_name text;
  linked_id uuid;
  target_id uuid;
begin
  object_bucket := case when tg_op = 'DELETE' then old.bucket_id else new.bucket_id end;
  object_name := case when tg_op = 'DELETE' then old.name else new.name end;

  if object_bucket not in ('community-post-media', 'community-comment-media') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  begin
    linked_id := (storage.foldername(object_name))[2]::uuid;
  exception when invalid_text_representation then
    return case when tg_op = 'DELETE' then old else new end;
  end;

  if object_bucket = 'community-post-media' then
    select p.community_id into target_id from public.community_posts p where p.id = linked_id;
  else
    select p.community_id into target_id
    from public.community_comments c
    join public.community_posts p on p.id = c.post_id
    where c.id = linked_id;
  end if;

  if target_id is not null and exists (
    select 1 from public.communities c
    where c.id = target_id and c.moderation_status = 'archived'
  ) then
    raise exception 'This Community was deleted by its owner and its media is read-only.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists community_storage_archived_read_only on storage.objects;
create trigger community_storage_archived_read_only
before insert or update or delete on storage.objects
for each row execute function community_private.reject_archived_community_storage_mutation();
