-- add_needs_review_to_dental_videos
ALTER TABLE public.dental_videos 
ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
