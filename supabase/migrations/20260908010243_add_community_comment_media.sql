create table if not exists public.community_comment_media (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  uploader_id uuid not null references public.profiles(user_id) on delete cascade,
  storage_bucket text not null default 'community-comment-media',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint community_comment_media_path_unique unique (storage_bucket, storage_path),
  constraint community_comment_media_size_check check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  constraint community_comment_media_type_check check (mime_type in ('image/jpeg','image/png','image/webp','image/gif','application/pdf')),
  constraint community_comment_media_sort_check check (sort_order between 0 and 2)
);

create index if not exists community_comment_media_comment_id_idx
  on public.community_comment_media(comment_id, sort_order);

alter table public.community_comment_media enable row level security;

revoke all on table public.community_comment_media from anon;
grant select, insert, delete on table public.community_comment_media to authenticated;

drop policy if exists community_comment_media_select on public.community_comment_media;
create policy community_comment_media_select
on public.community_comment_media
for select
to authenticated
using (community_private.current_user_can_view_comment(comment_id));

drop policy if exists community_comment_media_insert on public.community_comment_media;
create policy community_comment_media_insert
on public.community_comment_media
for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and storage_bucket = 'community-comment-media'
  and exists (
    select 1
    from public.community_comments c
    where c.id = comment_id
      and c.author_id = (select auth.uid())
  )
);

drop policy if exists community_comment_media_delete on public.community_comment_media;
create policy community_comment_media_delete
on public.community_comment_media
for delete
to authenticated
using (uploader_id = (select auth.uid()) or (select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-comment-media',
  'community-comment-media',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_comment_media_objects_insert on storage.objects;
create policy community_comment_media_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-comment-media'
  and (storage.foldername(name))[1] = ((select auth.uid()))::text
  and exists (
    select 1
    from public.community_comments c
    where c.id::text = (storage.foldername(name))[2]
      and c.author_id = (select auth.uid())
  )
);

drop policy if exists community_comment_media_objects_select on storage.objects;
create policy community_comment_media_objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'community-comment-media'
  and community_private.current_user_can_view_comment(
    (select c.id
     from public.community_comments c
     where c.id::text = (storage.foldername(storage.objects.name))[2])
  )
);

drop policy if exists community_comment_media_objects_delete on storage.objects;
create policy community_comment_media_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-comment-media'
  and (storage.foldername(name))[1] = ((select auth.uid()))::text
);
