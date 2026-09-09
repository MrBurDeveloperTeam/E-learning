-- Ordered after the existing restriction-appeals migration.
begin;

create or replace function public.community_decide_appeal(target_appeal_id uuid, appeal_decision text, review_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.community_appeals; restriction public.community_user_restrictions;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if appeal_decision is null or appeal_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  review_note := nullif(btrim(review_note), '');
  if length(review_note) > 1000 then raise exception 'Decision note must not exceed 1,000 characters'; end if;
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

notify pgrst, 'reload schema';
commit;
