create or replace function public.refresh_profile_video_count(target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles as p
  set video_count = (
    select count(*)::int
    from public.videos as v
    where v.creator_id = target_user_id
      and v.status = 'published'
  )
  where p.user_id = target_user_id;
$$;

create or replace function public.refresh_video_comment_count(target_video_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.videos as v
  set comment_count = (
    select count(*)::int
    from public.comments as c
    where c.video_id = target_video_id
  )
  where v.id = target_video_id;
$$;

create or replace function public.trg_refresh_profile_video_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.creator_id is not null then
    perform public.refresh_profile_video_count(old.creator_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.creator_id is not null then
    perform public.refresh_profile_video_count(new.creator_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.trg_refresh_video_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.video_id is not null then
    perform public.refresh_video_comment_count(old.video_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.video_id is not null then
    perform public.refresh_video_comment_count(new.video_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists zzz_refresh_profile_video_count_on_videos on public.videos;
create trigger zzz_refresh_profile_video_count_on_videos
after insert or delete or update of creator_id, status on public.videos
for each row
execute function public.trg_refresh_profile_video_count();

drop trigger if exists zzz_refresh_video_comment_count_on_comments on public.comments;
create trigger zzz_refresh_video_comment_count_on_comments
after insert or delete or update of video_id on public.comments
for each row
execute function public.trg_refresh_video_comment_count();

update public.profiles as p
set video_count = counts.video_count
from (
  select
    p2.user_id,
    count(v.id)::int as video_count
  from public.profiles as p2
  left join public.videos as v
    on v.creator_id = p2.user_id
   and v.status = 'published'
  group by p2.user_id
) as counts
where p.user_id = counts.user_id;

update public.videos as v
set comment_count = counts.comment_count
from (
  select
    v2.id,
    count(c.id)::int as comment_count
  from public.videos as v2
  left join public.comments as c
    on c.video_id = v2.id
  group by v2.id
) as counts
where v.id = counts.id;
