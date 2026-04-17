export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          email: string
          name: string | null
          full_name: string | null
          account_type: string | null
          phone: string | null
          position: string | null
          company_name: string | null
          avatar_url: string | null
          background_url: string | null
          clinic_id: string | null
          status: string
          plan: string | null
          role: string | null
          specialty: string | null
          registration_number: string | null
          institution: string | null
          bio: string | null
          is_verified: boolean | null
          is_kol: boolean | null
          is_creator: boolean | null
          video_count: number | null
          following_count: number | null
          follower_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email: string
          name?: string | null
          full_name?: string | null
          account_type?: string | null
          phone?: string | null
          position?: string | null
          company_name?: string | null
          avatar_url?: string | null
          background_url?: string | null
          clinic_id?: string | null
          status?: string
          plan?: string | null
          role?: string | null
          specialty?: string | null
          registration_number?: string | null
          institution?: string | null
          bio?: string | null
          is_verified?: boolean | null
          is_kol?: boolean | null
          is_creator?: boolean | null
          video_count?: number | null
          following_count?: number | null
          follower_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email?: string
          name?: string | null
          full_name?: string | null
          account_type?: string | null
          phone?: string | null
          position?: string | null
          company_name?: string | null
          avatar_url?: string | null
          background_url?: string | null
          clinic_id?: string | null
          status?: string
          plan?: string | null
          role?: string | null
          specialty?: string | null
          registration_number?: string | null
          institution?: string | null
          bio?: string | null
          is_verified?: boolean | null
          is_kol?: boolean | null
          is_creator?: boolean | null
          video_count?: number | null
          following_count?: number | null
          follower_count?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          creator_id: string
          title: string
          description: string | null
          category: string
          tags: string[]
          visibility: string
          status: string
          mux_upload_id: string | null
          mux_asset_id: string | null
          mux_playback_id: string | null
          thumbnail_url: string | null
          duration_seconds: number
          view_count: number
          like_count: number
          comment_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          title: string
          description?: string | null
          category: string
          tags?: string[]
          visibility?: string
          status?: string
          mux_upload_id?: string | null
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number
          view_count?: number
          like_count?: number
          comment_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          title?: string
          description?: string | null
          category?: string
          tags?: string[]
          visibility?: string
          status?: string
          mux_upload_id?: string | null
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          thumbnail_url?: string | null
          duration_seconds?: number
          view_count?: number
          like_count?: number
          comment_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      video_likes: {
        Row: {
          id: string
          user_id: string
          video_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          created_at?: string
        }
      }
      video_saves: {
        Row: {
          id: string
          user_id: string
          video_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          created_at?: string
        }
      }
      video_views: {
        Row: {
          id: string
          user_id: string | null
          video_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          video_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          video_id?: string
          viewed_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          video_id: string
          author_id: string
          parent_id: string | null
          body: string
          is_pinned: boolean
          like_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          video_id: string
          author_id: string
          parent_id?: string | null
          body: string
          is_pinned?: boolean
          like_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          author_id?: string
          parent_id?: string | null
          body?: string
          is_pinned?: boolean
          like_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      comment_likes: {
        Row: {
          id: string
          user_id: string
          comment_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          comment_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          comment_id?: string
          created_at?: string
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          actor_id: string
          type: string
          video_id: string | null
          comment_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          actor_id: string
          type: string
          video_id?: string | null
          comment_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          actor_id?: string
          type?: string
          video_id?: string | null
          comment_id?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          instructor_id: string
          title: string
          description: string | null
          specialty: string | null
          difficulty: string | null
          ce_hours: number | null
          accreditation_body: string | null
          thumbnail_url: string | null
          status: string
          price: number | null
          is_free: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          instructor_id: string
          title: string
          description?: string | null
          specialty?: string | null
          difficulty?: string | null
          ce_hours?: number | null
          accreditation_body?: string | null
          thumbnail_url?: string | null
          status?: string
          price?: number | null
          is_free?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          instructor_id?: string
          title?: string
          description?: string | null
          specialty?: string | null
          difficulty?: string | null
          ce_hours?: number | null
          accreditation_body?: string | null
          thumbnail_url?: string | null
          status?: string
          price?: number | null
          is_free?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      course_sections: {
        Row: {
          id: string
          course_id: string
          title: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          position: number
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          position?: number
          created_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          section_id: string
          course_id: string
          title: string
          description: string | null
          mux_asset_id: string | null
          mux_playback_id: string | null
          duration_seconds: number | null
          position: number
          is_required_for_ce: boolean | null
          min_watch_percent: number
          created_at: string
        }
        Insert: {
          id?: string
          section_id: string
          course_id: string
          title: string
          description?: string | null
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          duration_seconds?: number | null
          position?: number
          is_required_for_ce?: boolean | null
          min_watch_percent?: number
          created_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          course_id?: string
          title?: string
          description?: string | null
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          duration_seconds?: number | null
          position?: number
          is_required_for_ce?: boolean | null
          min_watch_percent?: number
          created_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          enrolled_at: string
          completed_at: string | null
          payment_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          enrolled_at?: string
          completed_at?: string | null
          payment_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          enrolled_at?: string
          completed_at?: string | null
          payment_id?: string | null
        }
      }
      watch_segments: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          started_at: number
          ended_at: number
          recorded_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          started_at: number
          ended_at: number
          recorded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          started_at?: number
          ended_at?: number
          recorded_at?: string
        }
      }
      lesson_completions: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed_at: string
          watch_percent: number | null
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed_at?: string
          watch_percent?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed_at?: string
          watch_percent?: number | null
        }
      }
      ce_completions: {
        Row: {
          id: string
          user_id: string
          course_id: string
          ce_hours: number | null
          accreditation_body: string | null
          completed_at: string
          certificate_url: string | null
          verification_code: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          ce_hours?: number | null
          accreditation_body?: string | null
          completed_at?: string
          certificate_url?: string | null
          verification_code: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          ce_hours?: number | null
          accreditation_body?: string | null
          completed_at?: string
          certificate_url?: string | null
          verification_code?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          lesson_id: string
          title: string | null
          pass_mark: number
          max_attempts: number
        }
        Insert: {
          id?: string
          lesson_id: string
          title?: string | null
          pass_mark?: number
          max_attempts?: number
        }
        Update: {
          id?: string
          lesson_id?: string
          title?: string | null
          pass_mark?: number
          max_attempts?: number
        }
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string
          question: string
          options: Json
          correct_index: number
          position: number
        }
        Insert: {
          id?: string
          quiz_id: string
          question: string
          options: Json
          correct_index: number
          position: number
        }
        Update: {
          id?: string
          quiz_id?: string
          question?: string
          options?: Json
          correct_index?: number
          position?: number
        }
      }
      quiz_attempts: {
        Row: {
          id: string
          user_id: string
          quiz_id: string
          score: number | null
          passed: boolean | null
          answers: Json
          attempted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quiz_id: string
          score?: number | null
          passed?: boolean | null
          answers?: Json
          attempted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quiz_id?: string
          score?: number | null
          passed?: boolean | null
          answers?: Json
          attempted_at?: string
        }
      }
      community_posts: {
        Row: {
          id: string
          author_id: string
          title: string
          body: string | null
          specialty: string | null
          is_anonymous: boolean | null
          image_urls: Json | null
          vote_count: number | null
          is_featured: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          title: string
          body?: string | null
          specialty?: string | null
          is_anonymous?: boolean | null
          image_urls?: Json | null
          vote_count?: number | null
          is_featured?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          title?: string
          body?: string | null
          specialty?: string | null
          is_anonymous?: boolean | null
          image_urls?: Json | null
          vote_count?: number | null
          is_featured?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      community_replies: {
        Row: {
          id: string
          post_id: string
          author_id: string
          body: string | null
          is_endorsed: boolean | null
          vote_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          body?: string | null
          is_endorsed?: boolean | null
          vote_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          author_id?: string
          body?: string | null
          is_endorsed?: boolean | null
          vote_count?: number | null
          created_at?: string
        }
      }
      dental_videos: {
        Row: {
          id: string
          video_id: string
          title: string
          description: string
          thumbnail_url: string
          channel_name: string
          published_at: string
          category: string | null
          confidence_score: number | null
          tags: string[] | null
          fetched_at: string
        }
        Insert: {
          id?: string
          video_id: string
          title: string
          description: string
          thumbnail_url: string
          channel_name: string
          published_at: string
          category?: string | null
          confidence_score?: number | null
          tags?: string[] | null
          fetched_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          title?: string
          description?: string
          thumbnail_url?: string
          channel_name?: string
          published_at?: string
          category?: string | null
          confidence_score?: number | null
          tags?: string[] | null
          fetched_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_post_votes: {
        Args: { post_id: string }
        Returns: void
      }
      increment_reply_votes: {
        Args: { reply_id: string }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
