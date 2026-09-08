-- Viewers may read only advertisements that are eligible for delivery.
-- Draft, paused, and hidden records remain visible only through the existing
-- administrator policy.
grant select on table public.video_advertisements to authenticated;

drop policy if exists "Authenticated users can view active advertisements"
  on public.video_advertisements;

create policy "Authenticated users can view active advertisements"
  on public.video_advertisements
  for select
  to authenticated
  using (status = 'active');
