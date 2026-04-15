create or replace function public.refresh_profile_follow_counts(target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles as p
  set
    follower_count = (
      select count(*)::int
      from public.follows as f
      where f.following_id = target_user_id
    ),
    following_count = (
      select count(*)::int
      from public.follows as f
      where f.follower_id = target_user_id
    )
  where p.user_id = target_user_id;
$$;

create or replace function public.trg_refresh_profile_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.follower_id is not null then
    perform public.refresh_profile_follow_counts(old.follower_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.following_id is not null then
    perform public.refresh_profile_follow_counts(old.following_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.follower_id is not null then
    perform public.refresh_profile_follow_counts(new.follower_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.following_id is not null then
    perform public.refresh_profile_follow_counts(new.following_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

delete from public.follows as f
where exists (
  select 1
  from public.follows as newer
  where newer.follower_id = f.follower_id
    and newer.following_id = f.following_id
    and (
      newer.created_at > f.created_at
      or (newer.created_at = f.created_at and newer.id > f.id)
    )
);

create unique index if not exists follows_follower_id_following_id_key
on public.follows (follower_id, following_id);

drop trigger if exists zzz_refresh_profile_follow_counts_on_follows on public.follows;
create trigger zzz_refresh_profile_follow_counts_on_follows
after insert or delete or update of follower_id, following_id on public.follows
for each row
execute function public.trg_refresh_profile_follow_counts();

update public.profiles as p
set
  follower_count = counts.follower_count,
  following_count = counts.following_count
from (
  select
    p2.user_id,
    count(distinct followers.id)::int as follower_count,
    count(distinct following.id)::int as following_count
  from public.profiles as p2
  left join public.follows as followers
    on followers.following_id = p2.user_id
  left join public.follows as following
    on following.follower_id = p2.user_id
  group by p2.user_id
) as counts
where p.user_id = counts.user_id;
