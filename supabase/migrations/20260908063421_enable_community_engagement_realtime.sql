-- Community engagement subscriptions use Postgres Changes. Keep this
-- idempotent so it is safe when a table was enabled manually in Dashboard.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'community_posts',
    'community_post_likes',
    'community_post_reposts',
    'community_comments',
    'community_comment_likes'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end
$$;
