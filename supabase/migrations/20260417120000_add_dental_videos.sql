create table if not exists public.dental_videos (
    id uuid primary key default gen_random_uuid(),
    video_id text not null unique,
    title text not null,
    description text not null,
    thumbnail_url text not null,
    channel_name text not null,
    published_at timestamptz not null,
    category text,
    confidence_score float4,
    tags text[],
    fetched_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.dental_videos enable row level security;

-- Drop existing policies if any (for idempotency during dev)
drop policy if exists "Enable read access for all users" on public.dental_videos;
drop policy if exists "Enable insert, update, delete for service role only" on public.dental_videos;

-- Public read access
create policy "Enable read access for all users" on public.dental_videos
    for select using (true);

-- Service role write access (requires bypass_rls on role or using service_role key)
create policy "Enable insert, update, delete for service role only" on public.dental_videos
    for all using (
        -- Service role uses the postgres role or bypasses RLS inherently, 
        -- but just in case, we can limit it by role if preferred, 
        -- however service_role token automatically bypasses RLS.
        -- We include this explicit policy for clarity if a specific role is used.
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );

-- Add comments for documentation
comment on table public.dental_videos is 'Imported YouTube dental videos for discovery and later categorization.';
comment on column public.dental_videos.video_id is 'YouTube video ID.';
comment on column public.dental_videos.category is 'Phase 3 category enrichment field.';
comment on column public.dental_videos.confidence_score is 'Phase 3 category confidence score.';
comment on column public.dental_videos.tags is 'Phase 3 enrichment tags.';
