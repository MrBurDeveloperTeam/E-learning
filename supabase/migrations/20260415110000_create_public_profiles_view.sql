create or replace view public.public_profiles as
select
  p.user_id,
  p.name,
  p.full_name,
  p.username,
  p.avatar_url,
  p.background_url,
  p.specialty,
  p.bio,
  p.institution,
  coalesce(p.is_verified, false) as is_verified,
  coalesce(p.is_creator, false) as is_creator,
  coalesce(p.follower_count, 0) as follower_count,
  coalesce(p.following_count, 0) as following_count,
  coalesce(p.video_count, 0) as video_count
from public.profiles as p;

grant select on public.public_profiles to anon;
grant select on public.public_profiles to authenticated;
