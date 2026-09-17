# Community report resolution

The frontend calls `community_resolve_report(target_report_id, decision)`.
The function is not installed automatically. Database access during implementation was read-only.

## Manual database setup

1. Open the E-learning Supabase project `opdotszsldcgwjqtvgul` and its SQL Editor.
2. Copy the entire `supabase/community-report-resolution.sql` file and run it.
3. Reload the admin Community review page using the updated frontend.

Dismiss sets all pending reports for the target to `dismissed` and `no_action`.
Resolve sets them to `resolved` and `no_action` without changing content visibility.
Hide content calls the existing comment, post, or community moderation function and sets the pending reports to `resolved` and `content_hidden` in the same transaction.
Previously closed reports retain their existing review history. The function verifies administrator access, records the reviewer and timestamps, and adds audit records. Existing report notification triggers run normally.

An already processed report produces a refresh error rather than silently overwriting another administrator's decision. A missing/deleted content target or a moderation failure rolls back hiding and report resolution together. Archived communities remain subject to the existing read-only restrictions. User reports support Dismiss and Resolve; hiding a user is rejected because user restrictions belong to the separate safety workflow.

## Verification

Run `node --test tests/communityReportResolution.test.mjs` for the API wrapper tests. These tests use a mock connection and do not access Supabase.
The SQL was checked against the deployed table columns, constraints, and existing moderation function definitions using SELECT queries only. Its execution and end-to-end database behavior remain to be verified after manual installation.
