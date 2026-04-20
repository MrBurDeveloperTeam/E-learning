-- RPC function: search dental videos with full-text search and pagination
-- Returns rows with a _total_count field for pagination metadata
CREATE OR REPLACE FUNCTION public.search_dental_videos(
  search_query text,
  filter_category text DEFAULT '',
  sort_by text DEFAULT 'published_at',
  sort_asc boolean DEFAULT false,
  page_from integer DEFAULT 0,
  page_limit integer DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  video_id text,
  title text,
  description text,
  thumbnail_url text,
  channel_name text,
  published_at timestamptz,
  category text,
  confidence_score float4,
  tags text[],
  needs_review boolean,
  fetched_at timestamptz,
  _total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT dv.*
    FROM public.dental_videos dv
    WHERE dv.needs_review = false
      AND dv.search_vector @@ to_tsquery('english', search_query)
      AND (filter_category = '' OR dv.category = filter_category)
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  )
  SELECT
    f.id,
    f.video_id,
    f.title,
    f.description,
    f.thumbnail_url,
    f.channel_name,
    f.published_at,
    f.category,
    f.confidence_score,
    f.tags,
    f.needs_review,
    f.fetched_at,
    c.total AS _total_count
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY
    CASE WHEN sort_by = 'published_at' AND sort_asc = false THEN f.published_at END DESC NULLS LAST,
    CASE WHEN sort_by = 'published_at' AND sort_asc = true  THEN f.published_at END ASC  NULLS LAST,
    CASE WHEN sort_by = 'confidence_score' AND sort_asc = false THEN f.confidence_score END DESC NULLS LAST,
    CASE WHEN sort_by = 'confidence_score' AND sort_asc = true  THEN f.confidence_score END ASC  NULLS LAST
  LIMIT page_limit
  OFFSET page_from;
END;
$$;

-- RPC function: get categories with counts
-- Returns distinct categories and their video counts, excluding needs_review
CREATE OR REPLACE FUNCTION public.get_dental_categories()
RETURNS TABLE (
  category text,
  count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    dv.category,
    count(*) AS count
  FROM public.dental_videos dv
  WHERE dv.needs_review = false
    AND dv.category IS NOT NULL
  GROUP BY dv.category
  ORDER BY count DESC;
$$;

-- Grant execute to authenticated and anon roles (service_role already has full access)
GRANT EXECUTE ON FUNCTION public.search_dental_videos TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dental_categories TO anon, authenticated;
