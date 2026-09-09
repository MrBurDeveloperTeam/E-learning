begin;

-- Additive RPCs: existing moderation functions and table policies are preserved.
create or replace function public.community_get_own_restrictions()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'actions', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select a.id, r.restriction_type as action_type, r.reason, r.created_at
      from public.community_safety_actions a
      join public.community_user_restrictions r on r.id = a.restriction_id
      where a.user_id = auth.uid() and r.user_id = auth.uid()
        and a.action_type = 'restriction_applied' and r.revoked_at is null
        and (r.expires_at is null or r.expires_at > now())
      order by r.created_at desc
    ) x), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select c.id, c.content as body, c.moderation_status as status,
        c.moderation_reason as moderation_note, c.created_at
      from public.community_comments c where c.author_id = auth.uid()
        and c.moderation_status in ('auto_hidden', 'admin_hidden', 'removed')
      order by c.created_at desc
    ) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.community_submit_restriction_appeal(
  target_comment_id uuid, target_action_id uuid, appeal_reason text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid; label text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if num_nonnulls(target_comment_id, target_action_id) <> 1 then raise exception 'Choose one appeal target'; end if;
  if appeal_reason is null or length(btrim(appeal_reason)) not between 20 and 2000 then
    raise exception 'Appeal reason must contain 20 to 2,000 characters';
  end if;
  -- Serialize submissions for this member, including concurrent browser tabs.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 91300));
  if target_comment_id is not null then
    select left(c.content, 80) into label from public.community_comments c
    where c.id = target_comment_id and c.author_id = auth.uid()
      and c.moderation_status in ('auto_hidden', 'admin_hidden', 'removed') for update;
  else
    select replace(r.restriction_type, '_', ' ') into label
    from public.community_safety_actions a join public.community_user_restrictions r on r.id = a.restriction_id
    where a.id = target_action_id and a.user_id = auth.uid() and r.user_id = auth.uid()
      and a.action_type = 'restriction_applied' and r.revoked_at is null
      and (r.expires_at is null or r.expires_at > now()) for update of r;
  end if;
  if not found then raise exception 'This restriction or comment is no longer eligible for appeal' using errcode = '42501'; end if;
  if exists (select 1 from public.community_appeals where appellant_id = auth.uid() and status = 'pending'
    and (comment_id = target_comment_id or moderation_action_id = target_action_id)) then
    raise exception 'A pending appeal already exists for this item';
  end if;
  insert into public.community_appeals(appellant_id, comment_id, moderation_action_id, target_label, reason)
  values(auth.uid(), target_comment_id, target_action_id, label, btrim(appeal_reason)) returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.community_decide_appeal(target_appeal_id uuid, appeal_decision text, review_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.community_appeals; restriction public.community_user_restrictions;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if appeal_decision is null or appeal_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  if review_note is null or length(btrim(review_note)) not between 5 and 1000 then raise exception 'Decision note must contain 5 to 1,000 characters'; end if;
  select * into item from public.community_appeals where id = target_appeal_id for update;
  if not found or item.status <> 'pending' then raise exception 'This appeal is no longer pending'; end if;
  if appeal_decision = 'approved' then
    if num_nonnulls(item.comment_id, item.moderation_action_id, item.community_id, item.post_id) <> 1 then
      raise exception 'This appeal has an invalid target';
    end if;
    if item.comment_id is not null then
      perform 1 from public.community_comments where id = item.comment_id and author_id = item.appellant_id for update;
      if not found then raise exception 'Appealed comment no longer exists'; end if;
      perform public.community_review_comment(item.comment_id, 'restore', btrim(review_note));
    elsif item.moderation_action_id is not null then
      select r.* into restriction from public.community_safety_actions a
      join public.community_user_restrictions r on r.id = a.restriction_id
      where a.id = item.moderation_action_id and a.user_id = item.appellant_id
        and r.user_id = item.appellant_id and a.action_type = 'restriction_applied' for update of r;
      if not found then raise exception 'Appealed restriction no longer exists'; end if;
      if restriction.revoked_at is null then perform public.community_revoke_user_restriction(restriction.id); end if;
    elsif item.community_id is not null then
      perform 1 from public.communities where id = item.community_id and owner_id = item.appellant_id for update;
      if not found then raise exception 'Appealed community no longer exists'; end if;
      perform public.community_review_community(item.community_id, 'approve', btrim(review_note));
    else
      raise exception 'Post appeals are not supported by this workflow';
    end if;
  end if;
  update public.community_appeals set status = appeal_decision, decision_note = btrim(review_note),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() where id = item.id;
end;
$$;

-- Keep appeal notifications separate from the legacy multi-table trigger,
-- which references fields (such as announcement) absent from appeal records.
create or replace function community_private.notify_restriction_appeal_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status and new.status in ('approved', 'rejected')
    and community_private.notification_enabled(new.appellant_id, 'moderation_updates') then
    insert into public.community_notifications(recipient_id, actor_id, notification_type, community_id, title, action_url)
    values(new.appellant_id, nullif(new.reviewed_by, new.appellant_id), 'appeal_decided', new.community_id,
      'Your Community appeal was reviewed', '/community?tab=me');
  end if;
  return new;
end;
$$;
drop trigger if exists community_notify_appeal_decision on public.community_appeals;
create trigger community_notify_appeal_decision after update of status on public.community_appeals
for each row execute function community_private.notify_restriction_appeal_decision();
revoke all on function community_private.notify_restriction_appeal_decision() from public, anon, authenticated;

revoke all on function public.community_get_own_restrictions() from public, anon;
revoke all on function public.community_submit_restriction_appeal(uuid, uuid, text) from public, anon;
revoke all on function public.community_decide_appeal(uuid, text, text) from public, anon;
grant execute on function public.community_get_own_restrictions() to authenticated;
grant execute on function public.community_submit_restriction_appeal(uuid, uuid, text) to authenticated;
grant execute on function public.community_decide_appeal(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
