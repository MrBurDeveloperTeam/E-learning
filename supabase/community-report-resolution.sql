-- Deployment SQL, intentionally not applied: Supabase access is read-only.
-- Execute this file only after database write access is authorized.
begin;

create or replace function public.community_resolve_report(target_report_id uuid, decision text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.community_reports%rowtype;
  report_item public.community_reports%rowtype;
  target_kind text;
  target_id uuid;
  pending_ids uuid[] := '{}'::uuid[];
  next_status text;
  next_action text;
  note text;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if decision is null or decision not in ('dismiss', 'resolve', 'hide') then
    raise exception 'Invalid report decision' using errcode = '22023';
  end if;
  select * into item from public.community_reports where id = target_report_id;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  target_kind := case when item.comment_id is not null then 'comment'
    when item.post_id is not null then 'post' when item.community_id is not null then 'community' else 'user' end;
  target_id := coalesce(item.comment_id, item.post_id, item.community_id, item.reported_user_id);

  -- Serialize moderation of the same target, then lock the pending group.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_kind || ':' || target_id::text, 0));
  select * into item from public.community_reports where id = target_report_id;
  if not found or item.report_status not in ('pending', 'reviewing') then
    raise exception 'Report already processed. Refresh the queue.' using errcode = '40001';
  end if;
  for report_item in
    select * from public.community_reports r
    where r.report_status in ('pending', 'reviewing')
      and case target_kind when 'comment' then r.comment_id = target_id
        when 'post' then r.post_id = target_id when 'community' then r.community_id = target_id
        else r.reported_user_id = target_id end
    order by r.id for update
  loop
    pending_ids := pg_catalog.array_append(pending_ids, report_item.id);
  end loop;
  if pg_catalog.cardinality(pending_ids) = 0 then
    raise exception 'No pending reports remain' using errcode = '40001';
  end if;

  next_status := case when decision = 'dismiss' then 'dismissed' else 'resolved' end;
  next_action := case when decision = 'hide' then 'content_hidden' else 'no_action' end;
  note := case decision when 'dismiss' then 'Dismissed by administrator'
    when 'resolve' then 'Reviewed and resolved without a content change'
    else 'Reported content hidden by administrator' end;
  if decision = 'hide' then
    if target_kind = 'comment' then
      perform public.community_review_comment(target_id, 'hide', note);
    elsif target_kind = 'post' then
      perform public.community_review_post(target_id, 'hide', note);
    elsif target_kind = 'community' then
      perform public.community_review_community(target_id, 'hide', note);
    else
      raise exception 'User reports require user safety actions; there is no content to hide' using errcode = '22023';
    end if;
  end if;

  -- Audit each pending report; previously closed reports retain their history.
  insert into community_private.community_admin_audit_log
    (admin_id, action_type, target_type, target_id, reason, previous_state, new_state)
  select auth.uid(), case when decision = 'dismiss' then 'report_dismissed' else 'report_resolved' end,
    'report', r.id, note,
    pg_catalog.jsonb_build_object('report_status', r.report_status, 'resolution_action', r.resolution_action),
    pg_catalog.jsonb_build_object('report_status', next_status, 'resolution_action', next_action)
  from public.community_reports r where r.id = any(pending_ids);
  update public.community_reports
  set report_status = next_status, resolution_action = next_action,
      resolution_note = note, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = any(pending_ids);
  return pg_catalog.cardinality(pending_ids);
end;
$$;

revoke all on function public.community_resolve_report(uuid, text) from public, anon;
grant execute on function public.community_resolve_report(uuid, text) to authenticated;
notify pgrst, 'reload schema';
commit;
