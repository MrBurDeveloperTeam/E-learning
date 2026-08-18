// Mandatory deterministic fallback — used ONLY when a deterministic
// provider succeeded (`status: 'ok'`) but the grounded Gemini phrasing
// request itself failed. Renders the full answer directly from the same
// model-safe facts, zero LLM involvement — never falls through to
// legacy General Chat.

import type { ElearningDataIntent } from '../contracts/groundedDataResult';
import type { LatestVideoPerformanceDataFacts } from '../providers/latestVideoPerformanceDataProvider';
import type { MostViewedVideoDataFacts } from '../providers/mostViewedVideoDataProvider';
import type { FollowedCreatorUpdatesDataFacts } from '../providers/followedCreatorUpdatesDataProvider';

function pluralizeView(n: number): string {
  return n === 1 ? '1 view' : `${n} views`;
}

function formatLatest(facts: LatestVideoPerformanceDataFacts): string {
  if (!facts.hasVideo) return "You don't have a published, public video yet.";
  return `Your latest published video has ${pluralizeView(facts.viewCount ?? 0)}.`;
}

function formatMostViewed(facts: MostViewedVideoDataFacts): string {
  if (!facts.hasViewedVideo) return 'None of your published public videos has any views yet.';
  return `Your most viewed video has ${pluralizeView(facts.viewCount ?? 0)}.`;
}

function formatFollowedUpdates(facts: FollowedCreatorUpdatesDataFacts): string {
  if (facts.count === 0) return "There are no new unread updates from creators you follow.";
  const truncation = facts.count > facts.shownCount ? ` Showing ${facts.shownCount} of ${facts.count}.` : '';
  const lines = facts.posts.map((p, i) => `${i + 1}. ${p.creatorDisplayName ?? 'A creator you follow'}`);
  return `${facts.count === 1 ? 'There is 1 new update' : `There are ${facts.count} new updates`} from creators you follow.${truncation}\n${lines.join('\n')}`;
}

export function formatGroundedElearningFallback(intent: ElearningDataIntent, facts: unknown): string {
  switch (intent) {
    case 'elearning_latest_video_performance':
      return formatLatest(facts as LatestVideoPerformanceDataFacts);
    case 'elearning_most_viewed_video':
      return formatMostViewed(facts as MostViewedVideoDataFacts);
    case 'elearning_followed_creator_updates':
      return formatFollowedUpdates(facts as FollowedCreatorUpdatesDataFacts);
    default:
      return "I couldn't format your answer right now.";
  }
}
