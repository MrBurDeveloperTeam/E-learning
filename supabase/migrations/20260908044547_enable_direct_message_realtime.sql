-- Direct-message subscriptions use Postgres Changes. Tables must be members of
-- Supabase's realtime publication before INSERT/UPDATE/DELETE events are sent.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'community_messages',
    'community_conversation_participants',
    'community_message_reactions'
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
