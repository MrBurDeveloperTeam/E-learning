export interface DentalVideo {
  id: string;
  video_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  channel_name: string;
  published_at: string; // ISO timestamp string
  category: string | null;
  confidence_score: number | null;
  tags: string[] | null;
  fetched_at: string; // ISO timestamp string
}
