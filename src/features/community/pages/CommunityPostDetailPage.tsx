import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RetryCard } from "@/components/shared/RetryCard";
import { CommunityPostCard } from "@/features/community/components/CommunityPostCard";
import { useCommunityPost } from "@/features/community/hooks/useCommunity";
import { useAuthStore } from "@/store/authStore";

export function CommunityPostDetailPage() {
  const { postId } = useParams({ from: "/community/post/$postId" }),
    user = useAuthStore((state) => state.user),
    query = useCommunityPost(postId, user?.id);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Button
          render={
            <Link
              to="/community"
              search={{
                tab: undefined,
                q: undefined,
                topic: undefined,
                sort: undefined,
              }}
            />
          }
          variant="ghost"
        >
          <ArrowLeft />
          Back to Community
        </Button>
        <div className="mt-5">
          {query.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : query.isError ? (
            <RetryCard onRetry={() => void query.refetch()} />
          ) : query.data ? (
            <CommunityPostCard post={query.data} userId={user?.id} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
