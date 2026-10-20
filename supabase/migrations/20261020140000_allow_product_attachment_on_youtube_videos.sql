-- Featured products on imported YouTube videos (public.dental_videos).
--
-- A featured product now belongs to EITHER an uploaded video (video_id) OR an
-- imported YouTube video (dental_video_id). YouTube videos have no creator, so
-- creator_id is NULL for them and no Snabbb Credit is ever awarded (see
-- functions/api/products/purchase-webhook.ts).
alter table public.video_products
    alter column video_id drop not null,
    alter column creator_id drop not null,
    add column if not exists dental_video_id uuid references public.dental_videos(id) on delete cascade;

alter table public.video_products drop constraint if exists video_products_exactly_one_video;
alter table public.video_products
    add constraint video_products_exactly_one_video check (
        (video_id is not null and dental_video_id is null and creator_id is not null)
        or (video_id is null and dental_video_id is not null and creator_id is null)
    );

alter table public.video_products drop constraint if exists video_products_dental_video_product_unique;
alter table public.video_products
    add constraint video_products_dental_video_product_unique unique (dental_video_id, product_ref);

create index if not exists video_products_dental_video_id_idx on public.video_products (dental_video_id);

-- Admins can attach to any uploaded video (keeping that video's creator) or to
-- any YouTube video (no creator). Replaces the narrower policy from
-- 20261020130000_allow_admin_attach_video_products.sql.
drop policy if exists "Admins can attach products to any video" on public.video_products;
create policy "Admins can attach products to any video" on public.video_products
    for insert
    to authenticated
    with check (
        public.is_current_user_admin()
        and (
            (
                dental_video_id is null
                and exists (
                    select 1 from public.videos v
                    where v.id = video_id and v.creator_id = video_products.creator_id
                )
            )
            or (
                dental_video_id is not null
                and video_id is null
                and creator_id is null
            )
        )
    );
