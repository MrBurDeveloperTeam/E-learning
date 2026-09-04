create table if not exists public.video_advertisement_settings (
  id boolean primary key default true,
  frequency_videos integer not null default 3,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamp with time zone not null default now(),
  constraint video_advertisement_settings_singleton check (id),
  constraint video_advertisement_settings_frequency_check check (frequency_videos between 1 and 100)
);

insert into public.video_advertisement_settings (id, frequency_videos)
values (true, 3)
on conflict (id) do nothing;

alter table public.video_advertisement_settings enable row level security;

grant select on table public.video_advertisement_settings to authenticated;
grant update on table public.video_advertisement_settings to authenticated;

drop policy if exists "Authenticated users can read advertisement settings"
  on public.video_advertisement_settings;
create policy "Authenticated users can read advertisement settings"
  on public.video_advertisement_settings
  for select
  to authenticated
  using (id = true);

drop policy if exists "Admins can update advertisement settings"
  on public.video_advertisement_settings;
create policy "Admins can update advertisement settings"
  on public.video_advertisement_settings
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin() and id = true);

comment on table public.video_advertisement_settings is
  'Singleton configuration controlling advertisement delivery across E-Learning videos.';
