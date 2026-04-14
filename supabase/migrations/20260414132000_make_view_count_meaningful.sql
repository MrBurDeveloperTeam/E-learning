create or replace function public.refresh_video_view_count(target_video_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.videos as v
  set view_count = (
    select count(*)::int
    from public.video_views as vv
    where vv.video_id = target_video_id
  )
  where v.id = target_video_id;
$$;

create or replace function public.trg_refresh_video_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.video_id is not null then
    perform public.refresh_video_view_count(old.video_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.video_id is not null then
    perform public.refresh_video_view_count(new.video_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.record_video_view(p_user_id uuid, p_video_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row boolean := false;
begin
  if p_user_id is null or p_video_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.video_views
    where user_id = p_user_id
      and video_id = p_video_id
      and viewed_at >= now() - interval '24 hours'
  ) then
    return false;
  end if;

  insert into public.video_views (user_id, video_id)
  values (p_user_id, p_video_id);

  inserted_row := true;
  return inserted_row;
end;
$$;

do $$
declare
  constraint_name text;
  index_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint as con
    join pg_class as rel on rel.oid = con.conrelid
    join pg_namespace as nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'video_views'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) ilike '%(user_id, video_id)%'
  loop
    execute format('alter table public.video_views drop constraint %I', constraint_name);
  end loop;

  for index_name in
    select idx.indexname
    from pg_indexes as idx
    where idx.schemaname = 'public'
      and idx.tablename = 'video_views'
      and idx.indexdef ilike '%unique%'
      and idx.indexdef ilike '%(user_id, video_id)%'
  loop
    execute format('drop index if exists public.%I', index_name);
  end loop;
end
$$;

drop trigger if exists zzz_refresh_video_view_count_on_video_views on public.video_views;
create trigger zzz_refresh_video_view_count_on_video_views
after insert or delete or update of video_id on public.video_views
for each row
execute function public.trg_refresh_video_view_count();

update public.videos as v
set view_count = counts.view_count
from (
  select
    v2.id,
    count(vv.id)::int as view_count
  from public.videos as v2
  left join public.video_views as vv
    on vv.video_id = v2.id
  group by v2.id
) as counts
where v.id = counts.id;
