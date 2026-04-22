create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.account_type = 'admin'
        or p.role = 'admin'
      )
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

drop policy if exists "Users can view own creator application" on public.creator_applications;
create policy "Users can view own creator application" on public.creator_applications
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_current_user_admin()
  );

drop policy if exists "Users can submit own creator application" on public.creator_applications;
create policy "Users can submit own creator application" on public.creator_applications
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_at is null
    and rejection_reason is null
  );

drop policy if exists "Admins can insert creator applications" on public.creator_applications;
create policy "Admins can insert creator applications" on public.creator_applications
  for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists "Users can resubmit own creator application" on public.creator_applications;
create policy "Users can resubmit own creator application" on public.creator_applications
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_current_user_admin()
  )
  with check (
    (
      auth.uid() = user_id
      and status = 'pending'
      and reviewed_at is null
      and rejection_reason is null
    )
    or public.is_current_user_admin()
  );
