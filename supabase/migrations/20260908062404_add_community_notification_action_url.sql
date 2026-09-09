begin;

-- Notification producers store an internal destination here. Keeping it
-- nullable preserves every pre-existing notification row.
alter table public.community_notifications
  add column if not exists action_url text;

alter table public.community_notifications
  drop constraint if exists community_notifications_action_url_check;

alter table public.community_notifications
  add constraint community_notifications_action_url_check
  check (
    action_url is null
    or (
      length(action_url) between 1 and 2048
      and action_url like '/%'
      and action_url not like '//%'
    )
  );

comment on column public.community_notifications.action_url is
  'Optional application-relative destination opened when the notification is selected.';

commit;
