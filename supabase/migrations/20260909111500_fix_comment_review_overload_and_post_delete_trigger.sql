begin;

-- PostgREST cannot resolve a two-argument call when a three-argument overload
-- also has a default third argument. Keep one unambiguous RPC contract.
drop function if exists public.community_review_comment(uuid, text);
drop function if exists public.community_review_comment(uuid, text, text);

create function public.community_review_comment(
  target_comment_id uuid,
  decision text,
  review_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_decision text := lower(btrim(coalesce(decision, '')));
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if normalized_decision in ('publish', 'restore') then
    update public.community_comments
    set moderation_status = 'visible',
        moderation_reason = 'admin_approved',
        moderation_approved_by = auth.uid(),
        moderation_approved_at = now(),
        updated_at = now()
    where id = target_comment_id;
  elsif normalized_decision in ('reject', 'remove') then
    update public.community_comments
    set moderation_status = 'removed',
        moderation_reason = coalesce(nullif(btrim(review_reason), ''), 'admin_removed'),
        moderation_approved_by = null,
        moderation_approved_at = null,
        updated_at = now()
    where id = target_comment_id;
  elsif normalized_decision = 'hide' then
    update public.community_comments
    set moderation_status = 'admin_hidden',
        moderation_reason = coalesce(nullif(btrim(review_reason), ''), 'admin_hidden'),
        moderation_approved_by = null,
        moderation_approved_at = null,
        updated_at = now()
    where id = target_comment_id;
  else
    raise exception 'Unsupported comment review decision: %', normalized_decision;
  end if;

  if not found then raise exception 'Comment not found'; end if;
end;
$$;

revoke all on function public.community_review_comment(uuid, text, text)
  from public, anon;
grant execute on function public.community_review_comment(uuid, text, text)
  to authenticated;

-- The shared notification trigger reads table-specific fields such as
-- communities.announcement. Give post moderation its own typed trigger so a
-- post update never attempts to read fields from another table.
create or replace function community_private.notify_community_post_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.moderation_status is distinct from new.moderation_status
     and new.author_id is distinct from (select auth.uid())
     and community_private.notification_enabled(new.author_id, 'moderation_updates') then
    insert into public.community_notifications(
      recipient_id, actor_id, notification_type, post_id, title, action_url
    ) values (
      new.author_id,
      (select auth.uid()),
      'moderation_action',
      new.id,
      'Your Community post was reviewed',
      '/community/post/' || new.id::text
    );
  end if;
  return new;
end;
$$;

revoke all on function community_private.notify_community_post_moderation()
  from public, anon, authenticated;

drop trigger if exists community_notify_post_moderation on public.community_posts;
create trigger community_notify_post_moderation
after update of moderation_status on public.community_posts
for each row execute function community_private.notify_community_post_moderation();

notify pgrst, 'reload schema';

commit;
