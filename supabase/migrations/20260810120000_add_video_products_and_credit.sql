-- E-Learning product purchase feature
--
-- Adds:
--   1. video_products          — Snabbb partner products a doctor attaches to one of their videos.
--   2. video_product_purchases — attribution ledger: which purchase came from which video/product,
--                                 and whether Snabbb Credit has been awarded for it.
--   3. snabbb_credit_settings  — admin-configurable rule for how much Snabbb Credit a doctor
--                                 earns per successful, paid purchase.
--
-- Products themselves are NOT owned by this database — they live in Odoo (Snabbb's partner
-- product catalog). We store a lightweight snapshot (name/image/price/url) at attach time so the
-- product button can render without an extra round trip, plus product_ref so the snapshot can be
-- refreshed and so purchases can be matched back to the right product.

-- ---------------------------------------------------------------------------
-- Reuse the existing admin check (see 20260422103000_fix_creator_applications_admin_policies.sql)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 1. video_products
-- ---------------------------------------------------------------------------
create table if not exists public.video_products (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos(id) on delete cascade,
    creator_id uuid not null references public.profiles(user_id) on delete cascade,

    -- Reference back to the Snabbb/Odoo partner product. product.template id, default_code,
    -- or barcode — whatever the catalog search endpoint returns as a stable identifier.
    product_ref text not null,

    -- Snapshot of the product at the time it was attached, so the featured product button can
    -- render immediately. Refreshed whenever a doctor re-adds/edits the attachment.
    product_name text not null,
    product_image_url text,
    product_price numeric(12, 2) not null default 0,
    currency text not null default 'MYR',
    product_url text not null,
    cta_label text not null default 'View Product',

    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (video_id, product_ref)
);

create index if not exists video_products_video_id_idx on public.video_products (video_id);
create index if not exists video_products_creator_id_idx on public.video_products (creator_id);

alter table public.video_products enable row level security;

drop policy if exists "Featured products are publicly readable" on public.video_products;
create policy "Featured products are publicly readable" on public.video_products
    for select using (true);

drop policy if exists "Creators can attach products to their own videos" on public.video_products;
create policy "Creators can attach products to their own videos" on public.video_products
    for insert
    to authenticated
    with check (
        auth.uid() = creator_id
        and exists (
            select 1 from public.videos v
            where v.id = video_id and v.creator_id = auth.uid()
        )
    );

drop policy if exists "Creators can update their own featured products" on public.video_products;
create policy "Creators can update their own featured products" on public.video_products
    for update
    to authenticated
    using (auth.uid() = creator_id or public.is_current_user_admin())
    with check (auth.uid() = creator_id or public.is_current_user_admin());

drop policy if exists "Creators can remove their own featured products" on public.video_products;
create policy "Creators can remove their own featured products" on public.video_products
    for delete
    to authenticated
    using (auth.uid() = creator_id or public.is_current_user_admin());

comment on table public.video_products is 'Snabbb partner products a doctor has attached to an E-Learning video, shown as clickable product buttons/cards to viewers.';
comment on column public.video_products.product_ref is 'Stable identifier for the product in the Snabbb/Odoo partner catalog.';
comment on column public.video_products.product_url is 'Snabbb product page URL viewers land on when they click the featured product.';

-- ---------------------------------------------------------------------------
-- 2. video_product_purchases
-- ---------------------------------------------------------------------------
create table if not exists public.video_product_purchases (
    id uuid primary key default gen_random_uuid(),

    video_id uuid not null references public.videos(id) on delete cascade,
    video_product_id uuid references public.video_products(id) on delete set null,
    product_ref text not null,
    doctor_id uuid not null references public.profiles(user_id) on delete cascade,

    -- Odoo order/sale identifiers used to reconcile webhook callbacks and prevent double-crediting.
    odoo_order_id text not null,
    odoo_order_line_id text,
    buyer_partner_id text,
    buyer_email text,

    amount numeric(12, 2) not null default 0,
    currency text not null default 'MYR',

    -- paid orders are the only ones eligible for credit; cancelled/refunded/failed never are.
    order_status text not null default 'pending'
        check (order_status in ('pending', 'paid', 'cancelled', 'refunded', 'failed')),

    credit_amount numeric(12, 2),
    credit_status text not null default 'pending'
        check (credit_status in ('pending', 'awarded', 'failed', 'not_applicable')),
    credited_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (odoo_order_id, product_ref)
);

create index if not exists video_product_purchases_video_id_idx on public.video_product_purchases (video_id);
create index if not exists video_product_purchases_doctor_id_idx on public.video_product_purchases (doctor_id);
create index if not exists video_product_purchases_order_status_idx on public.video_product_purchases (order_status);

alter table public.video_product_purchases enable row level security;

drop policy if exists "Doctors can view their own attributed purchases" on public.video_product_purchases;
create policy "Doctors can view their own attributed purchases" on public.video_product_purchases
    for select
    to authenticated
    using (auth.uid() = doctor_id or public.is_current_user_admin());

-- Only the webhook (service_role key, which bypasses RLS) writes to this table. This explicit
-- policy documents that intent and blocks client-side inserts/updates even if someone tries to
-- call the table directly with an authenticated/anon key.
drop policy if exists "Only service role manages purchase records" on public.video_product_purchases;
create policy "Only service role manages purchase records" on public.video_product_purchases
    for all
    using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
    with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

comment on table public.video_product_purchases is 'Attribution + Snabbb Credit ledger for purchases made through a featured E-Learning product. Populated by the Odoo order webhook; credit is only awarded once order_status = paid.';

-- ---------------------------------------------------------------------------
-- 3. snabbb_credit_settings
-- ---------------------------------------------------------------------------
create table if not exists public.snabbb_credit_settings (
    id boolean primary key default true, -- singleton row, enforced by the check below
    credit_type text not null default 'flat' check (credit_type in ('flat', 'percentage')),
    credit_value numeric(12, 2) not null default 0,
    currency text not null default 'MYR',
    is_active boolean not null default true,
    updated_by uuid references public.profiles(user_id),
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),

    constraint snabbb_credit_settings_singleton check (id)
);

insert into public.snabbb_credit_settings (id, credit_type, credit_value)
values (true, 'flat', 0)
on conflict (id) do nothing;

alter table public.snabbb_credit_settings enable row level security;

drop policy if exists "Anyone can read the active credit setting" on public.snabbb_credit_settings;
create policy "Anyone can read the active credit setting" on public.snabbb_credit_settings
    for select using (true);

drop policy if exists "Only admins can change credit settings" on public.snabbb_credit_settings;
create policy "Only admins can change credit settings" on public.snabbb_credit_settings
    for update
    to authenticated
    using (public.is_current_user_admin())
    with check (public.is_current_user_admin());

comment on table public.snabbb_credit_settings is 'Admin-configurable Snabbb Credit reward for successful E-Learning product purchases. Singleton row.';
comment on column public.snabbb_credit_settings.credit_type is 'flat = fixed credit_value per purchase; percentage = credit_value% of the order amount.';
