begin;

create table if not exists public.community_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.community_messages(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null default 'community-message-attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  attachment_type text not null check (attachment_type in ('image', 'video', 'file')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  sort_order smallint not null default 0 check (sort_order between 0 and 2),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

-- Some deployed projects already have an earlier version of this table.
-- CREATE TABLE IF NOT EXISTS does not add new columns, so reconcile it with
-- the shape used by the current client without removing any existing data.
alter table public.community_message_attachments
  add column if not exists uploaded_by uuid references auth.users(id) on delete cascade,
  add column if not exists storage_bucket text default 'community-message-attachments',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists attachment_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists sort_order smallint default 0,
  add column if not exists created_at timestamptz default now();

create unique index if not exists community_message_attachments_storage_path_idx
  on public.community_message_attachments (storage_bucket, storage_path)
  where storage_path is not null;

alter table public.community_message_attachments enable row level security;
grant select, insert, delete on public.community_message_attachments to authenticated;

drop policy if exists community_message_attachments_read on public.community_message_attachments;
create policy community_message_attachments_read
on public.community_message_attachments for select to authenticated
using (exists (
  select 1 from public.community_messages message
  join public.community_conversation_participants participant
    on participant.conversation_id = message.conversation_id
  where message.id = message_id and participant.user_id = (select auth.uid())
));

drop policy if exists community_message_attachments_insert on public.community_message_attachments;
create policy community_message_attachments_insert
on public.community_message_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and storage_bucket = 'community-message-attachments'
  and exists (
    select 1 from public.community_messages message
    join public.community_conversation_participants participant
      on participant.conversation_id = message.conversation_id
    where message.id = message_id
      and message.sender_id = (select auth.uid())
      and participant.user_id = (select auth.uid())
  )
);

drop policy if exists community_message_attachments_delete on public.community_message_attachments;
create policy community_message_attachments_delete
on public.community_message_attachments for delete to authenticated
using (uploaded_by = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-message-attachments',
  'community-message-attachments',
  false,
  10485760,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'application/pdf','text/plain','application/zip',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_message_attachment_objects_insert on storage.objects;
create policy community_message_attachment_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-message-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.community_conversation_participants participant
    where participant.conversation_id::text = (storage.foldername(name))[1]
      and participant.user_id = (select auth.uid())
  )
);

drop policy if exists community_message_attachment_objects_read on storage.objects;
create policy community_message_attachment_objects_read
on storage.objects for select to authenticated
using (
  bucket_id = 'community-message-attachments'
  and exists (
    select 1 from public.community_message_attachments attachment
    join public.community_messages message on message.id = attachment.message_id
    join public.community_conversation_participants participant
      on participant.conversation_id = message.conversation_id
    where attachment.storage_bucket = bucket_id
      and attachment.storage_path = name
      and participant.user_id = (select auth.uid())
  )
);

drop policy if exists community_message_attachment_objects_delete on storage.objects;
create policy community_message_attachment_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-message-attachments'
  and owner_id = (select auth.uid()::text)
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_message_attachments'
  ) then
    alter publication supabase_realtime add table public.community_message_attachments;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
