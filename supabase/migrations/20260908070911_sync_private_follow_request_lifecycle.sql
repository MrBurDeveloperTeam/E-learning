begin;

-- Once an approved follow is removed, remove its approval record too. This
-- makes the relationship eligible for a fresh request instead of leaving the
-- requester stuck in an accepted/pending-looking state.
create or replace function community_private.clear_profile_approval_after_unfollow()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  delete from public.community_friendships
  where requester_id = old.follower_id
    and addressee_id = old.following_id
    and friendship_status = 'accepted';
  return old;
end;
$$;

revoke all on function community_private.clear_profile_approval_after_unfollow() from public, anon, authenticated;

drop trigger if exists community_clear_approval_after_unfollow on public.community_follows;
create trigger community_clear_approval_after_unfollow
after delete on public.community_follows
for each row execute function community_private.clear_profile_approval_after_unfollow();

-- The profile button and request badge subscribe to both relationship tables.
do $$
declare
  target_table text;
begin
  foreach target_table in array array['community_follows', 'community_friendships']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end
$$;

commit;
