create or replace function community_private.current_user_conversation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select participant.conversation_id
  from public.community_conversation_participants as participant
  where participant.user_id = (select auth.uid());
$$;

revoke all on function community_private.current_user_conversation_ids() from public;
grant usage on schema community_private to authenticated;
grant execute on function community_private.current_user_conversation_ids() to authenticated;

drop policy if exists community_conversation_participants_receipts_select
  on public.community_conversation_participants;

create policy community_conversation_participants_receipts_select
on public.community_conversation_participants
for select
to authenticated
using (
  (select auth.uid()) is not null
  and conversation_id in (
    select community_private.current_user_conversation_ids()
  )
);
