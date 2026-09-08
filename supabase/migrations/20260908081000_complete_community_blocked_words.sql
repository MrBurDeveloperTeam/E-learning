begin;

create table if not exists public.community_blocked_words (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  severity text not null default 'block' check (severity in ('warn', 'review', 'block')),
  match_mode text not null default 'phrase' check (match_mode in ('word', 'phrase')),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint community_blocked_words_term_length check (char_length(btrim(term)) between 1 and 100)
);

create unique index if not exists community_blocked_words_term_unique
  on public.community_blocked_words (lower(btrim(term)));

alter table public.community_blocked_words enable row level security;

drop policy if exists community_blocked_words_admin_select on public.community_blocked_words;
create policy community_blocked_words_admin_select on public.community_blocked_words
for select to authenticated using ((select public.is_admin()));
drop policy if exists community_blocked_words_admin_insert on public.community_blocked_words;
create policy community_blocked_words_admin_insert on public.community_blocked_words
for insert to authenticated with check ((select public.is_admin()) and created_by = (select auth.uid()));
drop policy if exists community_blocked_words_admin_update on public.community_blocked_words;
create policy community_blocked_words_admin_update on public.community_blocked_words
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists community_blocked_words_admin_delete on public.community_blocked_words;
create policy community_blocked_words_admin_delete on public.community_blocked_words
for delete to authenticated using ((select public.is_admin()));

grant select, insert, update, delete on public.community_blocked_words to authenticated;

create or replace function public.community_check_comment_safety(input_body text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with matches as (
    select severity
    from public.community_blocked_words
    where is_active
      and case
        when match_mode = 'word' then lower(btrim(term)) = any(regexp_split_to_array(lower(input_body), '[^[:alnum:]_]+'))
        else position(lower(btrim(term)) in lower(input_body)) > 0
      end
  )
  select case
    when exists (select 1 from matches where severity = 'block') then 'block'
    when exists (select 1 from matches where severity = 'review') then 'review'
    when exists (select 1 from matches where severity = 'warn') then 'warn'
    else 'safe'
  end;
$$;

revoke all on function public.community_check_comment_safety(text) from public, anon;
grant execute on function public.community_check_comment_safety(text) to authenticated;

-- Re-check comments that existed before a blocked-word rule was created.
-- Only visible comments are changed; posts and previously moderated comments are untouched.
create or replace function public.community_rescan_visible_comments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_count integer;
begin
  update public.community_comments
  set
    moderation_status = 'auto_hidden',
    moderation_reason = 'blocked_word:' || public.community_check_comment_safety(content),
    updated_at = now()
  where moderation_status = 'visible'
    and public.community_check_comment_safety(content) in ('review', 'block');

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.community_rescan_visible_comments() from public, anon, authenticated;

create or replace function public.community_rescan_comments_after_blocked_word_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_active then
    perform public.community_rescan_visible_comments();
  end if;
  return new;
end;
$$;

drop trigger if exists community_blocked_words_rescan_comments on public.community_blocked_words;
create trigger community_blocked_words_rescan_comments
after insert or update of term, severity, match_mode, is_active
on public.community_blocked_words
for each row
execute function public.community_rescan_comments_after_blocked_word_change();

-- Also backfill immediately when this migration is applied to a database that
-- already contains active blocked-word rules.
select public.community_rescan_visible_comments();

commit;
