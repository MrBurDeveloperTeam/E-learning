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

-- Drafts are intentionally incomplete. Re-checking the row while changing its
-- status to hidden must not force the administrator to complete the form.
alter table public.video_advertisements
  drop constraint if exists video_advertisements_campaign_name_check,
  drop constraint if exists video_advertisements_advertiser_name_check,
  drop constraint if exists video_advertisements_alt_text_check,
  drop constraint if exists video_advertisements_media_url_check,
  drop constraint if exists video_advertisements_click_url_check,
  drop constraint if exists video_ads_cta_pair_check;

alter table public.video_advertisements
  add constraint video_advertisements_campaign_name_check
    check (
      status in ('draft', 'hidden')
      or (campaign_name is not null and char_length(trim(campaign_name)) between 1 and 150)
    ),
  add constraint video_advertisements_advertiser_name_check
    check (
      status in ('draft', 'hidden')
      or (advertiser_name is not null and char_length(trim(advertiser_name)) between 1 and 150)
    ),
  add constraint video_advertisements_alt_text_check
    check (
      status in ('draft', 'hidden')
      or (alt_text is not null and char_length(trim(alt_text)) between 1 and 300)
    ),
  add constraint video_advertisements_media_url_check
    check (
      status in ('draft', 'hidden')
      or (media_url is not null and media_url ~* '^https://')
    ),
  add constraint video_advertisements_click_url_check
    check (
      status in ('draft', 'hidden')
      or click_url is null
      or click_url ~* '^https://'
    ),
  add constraint video_ads_cta_pair_check
    check (
      status in ('draft', 'hidden')
      or (
        (cta_label is null and click_url is null)
        or (cta_label is not null and click_url is not null)
      )
    );

commit;
