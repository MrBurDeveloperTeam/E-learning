begin;

-- An unchanged comment that an administrator explicitly approved must not be
-- sent through the automatic blocked-word review loop again.
create or replace function public.community_keep_approved_comment_visible()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.moderation_status = 'auto_hidden'
     and coalesce(new.moderation_reason, '') like 'blocked_word:%'
     and new.content is not distinct from old.content
     and old.moderation_approved_at is not null then
    new.moderation_status := 'visible';
    new.moderation_reason := 'admin_approved';
    new.moderation_approved_by := old.moderation_approved_by;
    new.moderation_approved_at := old.moderation_approved_at;
  end if;
  return new;
end;
$$;

revoke all on function public.community_keep_approved_comment_visible()
  from public, anon, authenticated;

drop trigger if exists community_keep_approved_comment_visible
  on public.community_comments;
create trigger community_keep_approved_comment_visible
before update of moderation_status on public.community_comments
for each row execute function public.community_keep_approved_comment_visible();

-- A new report from someone other than the comment author is a new moderation
-- event. It deliberately clears the earlier approval and returns the comment
-- to review, even when its text has not changed.
create or replace function public.community_reopen_approved_comment_on_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.comment_id is not null and exists (
    select 1
    from public.community_comments comment
    where comment.id = new.comment_id
      and comment.author_id <> new.reporter_id
      and comment.moderation_status = 'visible'
      and comment.moderation_approved_at is not null
  ) then
    update public.community_comments
    set moderation_status = 'auto_hidden',
        moderation_reason = 'user_report',
        moderation_approved_by = null,
        moderation_approved_at = null,
        updated_at = now()
    where id = new.comment_id;
  end if;
  return new;
end;
$$;

revoke all on function public.community_reopen_approved_comment_on_report()
  from public, anon, authenticated;

drop trigger if exists community_reopen_approved_comment_on_report
  on public.community_reports;
create trigger community_reopen_approved_comment_on_report
after insert on public.community_reports
for each row execute function public.community_reopen_approved_comment_on_report();

-- Repair comments approved after the preceding migration but subsequently
-- returned to auto_hidden by an older rescan function.
update public.community_comments
set moderation_status = 'visible',
    moderation_reason = 'admin_approved',
    updated_at = now()
where moderation_status = 'auto_hidden'
  and moderation_approved_at is not null;

commit;
