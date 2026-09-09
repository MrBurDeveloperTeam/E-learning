begin;

alter table public.community_comments
  add column if not exists moderation_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_approved_at timestamptz;

create or replace function public.community_clear_comment_approval_after_edit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.content is distinct from old.content then
    new.moderation_approved_by := null;
    new.moderation_approved_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.community_clear_comment_approval_after_edit()
  from public, anon, authenticated;

drop trigger if exists community_clear_comment_approval_after_edit
  on public.community_comments;
create trigger community_clear_comment_approval_after_edit
before update of content on public.community_comments
for each row execute function public.community_clear_comment_approval_after_edit();

create or replace function public.community_review_comment(
  target_comment_id uuid,
  decision text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if decision in ('publish', 'restore') then
    update public.community_comments
    set moderation_status = 'visible',
        moderation_reason = 'admin_approved',
        moderation_approved_by = auth.uid(),
        moderation_approved_at = now(),
        updated_at = now()
    where id = target_comment_id;
  elsif decision = 'hide' then
    update public.community_comments
    set moderation_status = 'admin_hidden',
        moderation_reason = 'admin_hidden',
        moderation_approved_by = null,
        moderation_approved_at = null,
        updated_at = now()
    where id = target_comment_id;
  elsif decision in ('reject', 'remove') then
    update public.community_comments
    set moderation_status = 'removed',
        moderation_reason = 'admin_removed',
        moderation_approved_by = null,
        moderation_approved_at = null,
        updated_at = now()
    where id = target_comment_id;
  else
    raise exception 'Unsupported comment review decision';
  end if;

  if not found then
    raise exception 'Comment not found';
  end if;
end;
$$;

revoke all on function public.community_review_comment(uuid, text)
  from public, anon;
grant execute on function public.community_review_comment(uuid, text)
  to authenticated;

create or replace function public.community_rescan_visible_comments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_count integer;
begin
  update public.community_comments
  set moderation_status = 'auto_hidden',
      moderation_reason = 'blocked_word:' || public.community_check_comment_safety(content),
      updated_at = now()
  where moderation_status = 'visible'
    and moderation_approved_at is null
    and public.community_check_comment_safety(content) in ('review', 'block');

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.community_rescan_visible_comments()
  from public, anon, authenticated;

commit;
