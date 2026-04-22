create table if not exists public.creator_applications (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  status text not null default 'pending',
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint creator_applications_status_check check (
    status = any (
      array[
        'pending'::text,
        'approved'::text,
        'rejected'::text,
        'revoked'::text
      ]
    )
  )
);

create index if not exists creator_applications_status_submitted_idx
  on public.creator_applications (status, submitted_at desc);

insert into public.creator_applications (
  user_id,
  status,
  submitted_at,
  reviewed_at,
  rejection_reason,
  created_at,
  updated_at
)
select
  p.user_id,
  'approved',
  p.created_at,
  p.updated_at,
  null,
  timezone('utc', now()),
  timezone('utc', now())
from public.profiles p
where coalesce(p.is_creator, false) = true
  and coalesce(p.is_verified, false) = true
on conflict (user_id) do nothing;

alter table public.creator_applications enable row level security;

drop policy if exists "Users can view own creator application" on public.creator_applications;
create policy "Users can view own creator application" on public.creator_applications
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
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
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "Users can resubmit own creator application" on public.creator_applications;
create policy "Users can resubmit own creator application" on public.creator_applications
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    (
      auth.uid() = user_id
      and status = 'pending'
      and reviewed_at is null
      and rejection_reason is null
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  );
