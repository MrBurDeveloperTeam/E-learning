begin;

create table if not exists public.community_conversation_deletions (
  conversation_id uuid not null references public.community_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_before timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.community_conversation_deletions enable row level security;

drop policy if exists community_conversation_deletions_own on public.community_conversation_deletions;
create policy community_conversation_deletions_own
on public.community_conversation_deletions
for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.community_conversation_participants participant
    where participant.conversation_id = community_conversation_deletions.conversation_id
      and participant.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete
on public.community_conversation_deletions
to authenticated;

notify pgrst, 'reload schema';

commit;
