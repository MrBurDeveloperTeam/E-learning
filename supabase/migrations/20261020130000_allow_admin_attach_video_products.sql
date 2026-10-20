-- Lets platform admins attach partner products to ANY video from the admin
-- "Featured products" page. creator_id stays the video's creator so purchase
-- credit is still attributed to the doctor who owns the video.
drop policy if exists "Admins can attach products to any video" on public.video_products;
create policy "Admins can attach products to any video" on public.video_products
    for insert
    to authenticated
    with check (
        public.is_current_user_admin()
        and exists (
            select 1 from public.videos v
            where v.id = video_id and v.creator_id = video_products.creator_id
        )
    );
