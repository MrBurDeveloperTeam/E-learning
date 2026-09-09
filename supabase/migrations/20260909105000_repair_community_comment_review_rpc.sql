begin;

alter table public.community_comments
  add column if not exists moderation_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_approved_at timestamptz;

create or replace function public.community_review_comment(
  target_comment_id uuid,
  decision text
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
    raise exception 'Administrator access required';
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
        moderation_reason = 'admin_removed',
        moderation_approved_by = null,
        moderation_approved_at = null,
        updated_at = now()
    where id = target_comment_id;
  elsif normalized_decision = 'hide' then
    update public.community_comments
    set moderation_status = 'admin_hidden',
        moderation_reason = 'admin_hidden',
        moderation_approved_by = null,
        moderation_approved_at = null,
        updated_at = now()
    where id = target_comment_id;
  else
    raise exception 'Unsupported comment review decision: %', normalized_decision;
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

-- Prompt PostgREST to reload the repaired RPC immediately.
notify pgrst, 'reload schema';

commit;
