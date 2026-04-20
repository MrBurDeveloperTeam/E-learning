-- Add full-text search support to dental_videos
-- Generated tsvector column combining title and description
ALTER TABLE public.dental_videos
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
) STORED;

-- GIN index for fast full-text search lookups
CREATE INDEX IF NOT EXISTS idx_dental_videos_search_vector
ON public.dental_videos USING GIN (search_vector);

-- Additional index on category for filtered queries
CREATE INDEX IF NOT EXISTS idx_dental_videos_category
ON public.dental_videos (category);

-- Additional index on needs_review for the public exclusion filter
CREATE INDEX IF NOT EXISTS idx_dental_videos_needs_review
ON public.dental_videos (needs_review);

-- Comment for documentation
COMMENT ON COLUMN public.dental_videos.search_vector IS 'Auto-generated tsvector for full-text search across title and description.';
