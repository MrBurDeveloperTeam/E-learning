begin;

-- A hidden advertisement remains stored but is excluded from administration
-- lists and can never be selected for delivery.
alter table public.video_advertisements
  drop constraint if exists video_advertisements_status_check;

alter table public.video_advertisements
  add constraint video_advertisements_status_check
  check (status in ('draft', 'active', 'paused', 'archived', 'hidden'));

-- Permit incomplete drafts to move to hidden without requiring media first.
alter table public.video_advertisements
  drop constraint if exists video_ads_media_source_check;

alter table public.video_advertisements
  drop constraint if exists video_ads_upload_path_check;

alter table public.video_advertisements
  add constraint video_ads_media_source_check
  check (
    status in ('draft', 'hidden')
    or (
      (media_source = 'external' and media_storage_path is null)
      or (
        media_source = 'upload'
        and media_storage_path is not null
        and char_length(trim(media_storage_path)) > 0
      )
    )
  );

commit;
