create or replace function public.refresh_video_like_count(target_video_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.videos as v
  set like_count = (
    select count(*)::int
    from public.video_likes as vl
    where vl.video_id = target_video_id
  )
  where v.id = target_video_id;
$$;

create or replace function public.refresh_comment_like_count(target_comment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.comments as c
  set like_count = (
    select count(*)::int
    from public.comment_likes as cl
    where cl.comment_id = target_comment_id
  )
  where c.id = target_comment_id;
$$;

create or replace function public.trg_refresh_video_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.video_id is not null then
    perform public.refresh_video_like_count(old.video_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.video_id is not null then
    perform public.refresh_video_like_count(new.video_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.trg_refresh_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.comment_id is not null then
    perform public.refresh_comment_like_count(old.comment_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.comment_id is not null then
    perform public.refresh_comment_like_count(new.comment_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

delete from public.video_likes as vl
where exists (
  select 1
  from public.video_likes as newer
  where newer.user_id = vl.user_id
    and newer.video_id = vl.video_id
    and (
      newer.created_at > vl.created_at
      or (newer.created_at = vl.created_at and newer.id > vl.id)
    )
);

delete from public.comment_likes as cl
where exists (
  select 1
  from public.comment_likes as newer
  where newer.user_id = cl.user_id
    and newer.comment_id = cl.comment_id
    and (
      newer.created_at > cl.created_at
      or (newer.created_at = cl.created_at and newer.id > cl.id)
    )
);

create unique index if not exists video_likes_user_id_video_id_key
on public.video_likes (user_id, video_id);

create unique index if not exists comment_likes_user_id_comment_id_key
on public.comment_likes (user_id, comment_id);

drop trigger if exists zzz_refresh_video_like_count_on_video_likes on public.video_likes;
create trigger zzz_refresh_video_like_count_on_video_likes
after insert or delete or update of video_id on public.video_likes
for each row
execute function public.trg_refresh_video_like_count();

drop trigger if exists zzz_refresh_comment_like_count_on_comment_likes on public.comment_likes;
create trigger zzz_refresh_comment_like_count_on_comment_likes
after insert or delete or update of comment_id on public.comment_likes
for each row
execute function public.trg_refresh_comment_like_count();

update public.videos as v
set like_count = counts.like_count
from (
  select
    v2.id,
    count(vl.id)::int as like_count
  from public.videos as v2
  left join public.video_likes as vl
    on vl.video_id = v2.id
  group by v2.id
) as counts
where v.id = counts.id;

update public.comments as c
set like_count = counts.like_count
from (
  select
    c2.id,
    count(cl.id)::int as like_count
  from public.comments as c2
  left join public.comment_likes as cl
    on cl.comment_id = c2.id
  group by c2.id
) as counts
where c.id = counts.id;
