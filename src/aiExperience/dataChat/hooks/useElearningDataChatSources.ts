import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { fetchOwnVideoAnalyticsSnapshot, fetchMyVideos } from '@/lib/queries/videos';
import { fetchNotifications } from '@/lib/queries/notifications';
import { fetchFollowing } from '@/lib/queries/follows';
import { createUseElearningDataChatSources } from '@mrburdeveloperteam/pet-function/apps/elearning';
export type { ElearningDataChatSources } from '@mrburdeveloperteam/pet-function/apps/elearning';
export const useElearningDataChatSources = createUseElearningDataChatSources({ useQuery, useAuthStore, fetchOwnVideoAnalyticsSnapshot, fetchMyVideos, fetchNotifications, fetchFollowing });
