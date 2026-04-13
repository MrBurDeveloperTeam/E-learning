-- Normalize legacy overlapping account_type values before tightening the constraint.
update public.profiles
set account_type = case
  when role = 'admin' then 'admin'
  else 'individual'
end
where account_type in ('member', 'creator');

alter table public.profiles
drop constraint if exists profiles_account_type_check;

alter table public.profiles
add constraint profiles_account_type_check check (
  account_type = any (
    array[
      'individual'::text,
      'company'::text,
      'admin'::text
    ]
  )
);
