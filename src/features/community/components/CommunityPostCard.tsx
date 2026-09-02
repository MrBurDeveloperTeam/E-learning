import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  GraduationCap,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Trash2,
  EyeOff,
  Pencil,
  Pin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  useCommunityPostActions,
  useCommunityPostInteraction,
} from "@/features/community/hooks/useCommunity";
import type { CommunityPost } from "@/features/community/types";
import { cn } from "@/lib/utils";
import { CommunityReportDialog } from "@/features/community/components/CommunityReportDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CommunityMediaCarousel } from "@/features/community/components/CommunityMediaCarousel";

const CommunityComments = lazy(() =>
  import("@/features/community/components/CommunityComments").then((module) => ({
    default: module.CommunityComments,
  })),
);

function formatPostDate(value: string | null) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function CommunityPostCard({
  post,
  userId,
  autoplayVideos = false,
}: {
  post: CommunityPost;
  userId?: string;
  autoplayVideos?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false),
    [editTitle, setEditTitle] = useState(post.title ?? ""),
    [editBody, setEditBody] = useState(post.body ?? "");
  const [repostOpen, setRepostOpen] = useState(false),
    [repostComment, setRepostComment] = useState("");
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const interaction = useCommunityPostInteraction(userId);
  const actions = useCommunityPostActions(userId);
  const authorName =
    post.profiles?.full_name || post.profiles?.name || "Community member";

  async function toggle(
    table:
      | "community_post_likes"
      | "community_post_reposts"
      | "community_post_bookmarks",
    active: boolean,
    success: string,
  ) {
    if (!userId) {
      toast.info("Sign in to interact with posts.");
      return;
    }
    try {
      await interaction.mutateAsync({
        table,
        postId: post.id,
        active: !active,
      });
      toast.success(success);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/community/post/${post.id}`,
      );
      await actions.mutateAsync({ action: "share", postId: post.id });
      toast.success("Post link copied.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not share post.",
      );
    }
  }
  async function repost() {
    if (!userId) return toast.info("Sign in to repost.");
    try {
      await interaction.mutateAsync({
        table: "community_post_reposts",
        postId: post.id,
        active: !post.viewer_has_reposted,
        comment: repostComment,
      });
      setRepostOpen(false);
      setRepostComment("");
      toast.success(
        post.viewer_has_reposted ? "Repost removed." : "Post reposted.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not repost.");
    }
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="p-5 sm:p-6">
        {post.friend_activity && post.friend_activity.length > 0 && (
          <p className="mb-4 text-xs font-medium text-primary">
            {post.friend_activity_names?.join(", ") || "A friend"}{" "}
            {post.friend_activity.join(" and ")} this post
          </p>
        )}
        {post.recommendation_reason && (
          <p className="mb-4 text-xs font-medium text-primary">
            {post.recommendation_reason}
          </p>
        )}
        {post.post_type === "video" &&
          post.viewer_progress !== undefined &&
          post.viewer_progress > 0 && (
            <div className="mb-4">
              <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>
                  {post.viewer_completed ? "Watched" : "Continue watching"}
                </span>
                <span>{Math.round(post.viewer_progress * 100)}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.round(post.viewer_progress * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        <header className="flex items-start gap-3">
          <UserAvatar
            name={authorName}
            avatarUrl={post.profiles?.avatar_url}
            size={42}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-foreground">
                {authorName}
              </p>
              {post.is_pinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                  <Pin className="size-3" />
                  Pinned
                </span>
              )}
              {post.profiles?.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <GraduationCap className="size-3" aria-hidden="true" />{" "}
                  Verified
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {post.communities?.name ?? "Dental community"} ·{" "}
              {formatPostDate(post.published_at)}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {post.post_type === "video"
              ? post.topic.replaceAll("_", " ")
              : post.post_type}
          </span>
        </header>

        {post.media.length > 0 && (
          <CommunityMediaCarousel
            media={post.media}
            postTitle={post.title}
            autoplayVideos={autoplayVideos}
            viewerProgress={post.viewer_progress}
            onVideoPlay={() =>
              void actions.mutateAsync({ action: "view", postId: post.id })
            }
            onVideoPause={(currentTime, duration) => {
              if (duration)
                void actions.mutateAsync({
                  action: "view",
                  postId: post.id,
                  watchSeconds: Math.round(currentTime),
                  progress: currentTime / duration,
                });
            }}
            onVideoEnded={(duration) =>
              void actions.mutateAsync({
                action: "view",
                postId: post.id,
                watchSeconds: Math.round(duration),
                progress: 1,
              })
            }
          />
        )}

        <footer className="mt-4 flex items-center gap-1 border-t border-border/70 pt-3">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={post.viewer_has_liked}
            disabled={interaction.isPending}
            className={cn(
              post.viewer_has_liked && "text-rose-500 hover:text-rose-500",
            )}
            onClick={() =>
              void toggle(
                "community_post_likes",
                post.viewer_has_liked,
                post.viewer_has_liked ? "Like removed." : "Post liked.",
              )
            }
          >
            <Heart className={cn(post.viewer_has_liked && "fill-current")} />{" "}
            {post.like_count}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Share post"
            disabled={actions.isPending}
            onClick={() => void share()}
          >
            <Share2 />
          </Button>
          {userId && userId !== post.author_id && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Not interested"
              disabled={actions.isPending}
              onClick={() =>
                void actions
                  .mutateAsync({ action: "not_interested", postId: post.id })
                  .then(() =>
                    toast.success("We will show fewer posts like this."),
                  )
              }
            >
              <EyeOff />
            </Button>
          )}
          {userId === post.author_id && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit post"
                onClick={() => setEditOpen(true)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete post"
                disabled={actions.isPending}
                onClick={() => {
                  if (!window.confirm("Delete this post? It will no longer be visible in the Community feed.")) return;
                  void actions
                    .mutateAsync({ action: "delete", postId: post.id })
                    .then(() => toast.success("Post deleted."))
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Could not delete post."));
                }}
              >
                <Trash2 />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={commentsExpanded}
            aria-controls={`comments-${post.id}`}
            onClick={() => {
              setCommentsExpanded((current) => !current);
              if (!commentsExpanded) window.setTimeout(() => document.getElementById(`comments-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
            }}
          >
            <MessageCircle /> {post.comment_count}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={post.viewer_has_reposted}
            disabled={interaction.isPending}
            className={cn(post.viewer_has_reposted && "text-primary")}
            onClick={() =>
              post.viewer_has_reposted ? void repost() : setRepostOpen(true)
            }
          >
            <Repeat2 /> {post.repost_count}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              post.viewer_has_bookmarked ? "Remove bookmark" : "Bookmark post"
            }
            aria-pressed={post.viewer_has_bookmarked}
            disabled={interaction.isPending}
            className={cn(
              "ml-auto",
              post.viewer_has_bookmarked && "text-primary",
            )}
            onClick={() =>
              void toggle(
                "community_post_bookmarks",
                post.viewer_has_bookmarked,
                post.viewer_has_bookmarked
                  ? "Bookmark removed."
                  : "Post saved.",
              )
            }
          >
            <Bookmark
              className={cn(post.viewer_has_bookmarked && "fill-current")}
            />
          </Button>
          {userId && userId !== post.author_id && (
            <CommunityReportDialog
              userId={userId}
              postId={post.id}
              targetName={post.title || "this post"}
            />
          )}
        </footer>
        {(post.title || post.body) && (
          <div className="mt-3 border-b border-border/70 pb-4">
            {post.title && (
              <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                <Link
                  to="/community/post/$postId"
                  params={{ postId: post.id }}
                  className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {post.title}
                </Link>
              </h2>
            )}
            {post.body && (
              <p className={cn("whitespace-pre-wrap text-sm leading-6 text-muted-foreground", post.title && "mt-1.5")}>
                {post.body}
              </p>
            )}
          </div>
        )}
        <div id={`comments-${post.id}`}>
            <Suspense
              fallback={
                <div
                  className="flex min-h-32 items-center justify-center border-t border-border/70"
                  role="status"
                  aria-label="Loading comments"
                >
                  <LoadingSpinner />
                </div>
              }
            >
              <CommunityComments
                postId={post.id}
                userId={userId}
                postAuthorId={post.author_id}
                expanded={commentsExpanded}
              />
            </Suspense>
        </div>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <Input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            maxLength={200}
            placeholder="Title"
          />
          <Textarea
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
            maxLength={20000}
            className="min-h-40 resize-none"
          />
          <Button
            disabled={!editBody.trim() || actions.isPending}
            onClick={() =>
              void actions
                .mutateAsync({
                  action: "edit",
                  postId: post.id,
                  title: editTitle,
                  body: editBody,
                  topic: post.topic,
                })
                .then(() => {
                  setEditOpen(false);
                  toast.success("Post updated.");
                })
                .catch((error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not update post.",
                  ),
                )
            }
          >
            Save changes
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={repostOpen} onOpenChange={setRepostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repost</DialogTitle>
          </DialogHeader>
          <Textarea
            value={repostComment}
            onChange={(event) => setRepostComment(event.target.value)}
            maxLength={1000}
            className="min-h-28 resize-none"
            placeholder="Add an optional note…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRepostOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={interaction.isPending}
              onClick={() => void repost()}
            >
              Repost
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
