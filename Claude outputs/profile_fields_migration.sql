-- Adds the columns needed for the new Specialty and Address fields
-- on the Image-generator profile settings page.
--
-- Note: `dob` and `country` columns are assumed to already exist on
-- `profiles` (the code was already reading/writing them before this
-- change). If either is missing, uncomment the matching line below.

alter table public.profiles
  add column if not exists specialty text[],
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text;

-- Uncomment if these turn out to be missing too:
-- alter table public.profiles add column if not exists dob text;
-- alter table public.profiles add column if not exists country text;
