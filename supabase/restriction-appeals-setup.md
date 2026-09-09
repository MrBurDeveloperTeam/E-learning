# Restriction appeals deployment

Run the complete contents of `migrations/20260909130000_complete_restriction_appeals.sql` in the existing project's Supabase SQL Editor, then deploy the frontend.

The migration runs in a transaction. It adds three public RPCs and an appeal-only notification function. It replaces only the appeal-decision notification trigger to avoid the legacy shared trigger accessing columns from other tables. It does not modify existing moderation RPCs, RLS policies, rows, Realtime publications, or global UI styles.

It requires the existing Community appeals, user-safety, notifications, and comment-review migrations to have been applied. It has not been executed against the hosted database. Run this read-only prerequisite check first; all results should be true:

```sql
select
  to_regclass('public.community_appeals') is not null as appeals_ready,
  to_regclass('public.community_safety_actions') is not null as actions_ready,
  to_regclass('public.community_user_restrictions') is not null as restrictions_ready,
  to_regprocedure('public.community_review_comment(uuid,text,text)') is not null as comment_review_ready,
  to_regprocedure('public.community_revoke_user_restriction(uuid)') is not null as revoke_ready,
  to_regprocedure('public.community_review_community(uuid,text,text)') is not null as community_review_ready,
  to_regprocedure('community_private.notification_enabled(uuid,text)') is not null as notifications_ready;
```

After deployment, verify with test accounts:

1. A restricted member sees only their own active restrictions and moderated comments.
2. Submit a reason of 20–2,000 characters; the item shows “Appeal pending” and appears in Appeals history. A duplicate pending request is rejected by the server.
3. Another member cannot appeal that item; a non-admin cannot call the decision RPC.
4. Admin Community review displays the pending appeal. Reject with a note: the restriction remains and the member can see the response.
5. Approve a restriction appeal: only the linked restriction is revoked. Approve a comment appeal: the existing restore function marks it admin-approved.
6. Withdraw a pending appeal from history. A reviewed/withdrawn appeal cannot be decided again.
7. Check Privacy settings at mobile and desktop widths in both themes; labels sit above the dropdowns and preference saving still works.

No extra polling or Realtime subscriptions are added. Approval intentionally changes only the appealed target's moderation state. Notifications use the existing member notification preference.
