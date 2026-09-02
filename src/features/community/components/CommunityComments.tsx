import { useMemo, useState } from "react";
import {
  Award,
  Check,
  FileText,
  GraduationCap,
  Heart,
  Image,
  Paperclip,
  Pencil,
  Pin,
  Reply,
  Search,
  ShieldAlert,
  Trash2,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RetryCard } from "@/components/shared/RetryCard";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  useCheckCommunityCommentSafety,
  useCommunityCommentFeature,
  useCommunityCommentLike,
  useCommunityComments,
  useCommunityMentionUsers,
  useCommunityUserBlock,
  useCreateCommunityComment,
  useDeleteCommunityComment,
  useUpdateCommunityComment,
} from "@/features/community/hooks/useCommunity";
import type { CommunityComment } from "@/features/community/types";
import { CommunityReportDialog } from "@/features/community/components/CommunityReportDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function commentDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function mentionTail(value: string) {
  return value.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/)?.[1] ?? "";
}

export function CommunityComments({
  postId,
  userId,
  postAuthorId,
  expanded = false,
}: {
  postId: string;
  userId?: string;
  postAuthorId?: string;
  expanded?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [searchInput, setSearchInput] = useState("");
  const query = useCommunityComments(postId, userId, true, expanded ? -1 : 0, expanded ? search : "");
  const createMutation = useCreateCommunityComment(postId, userId),
    updateMutation = useUpdateCommunityComment(postId, userId),
    deleteMutation = useDeleteCommunityComment(postId, userId);
  const likeMutation = useCommunityCommentLike(postId, userId),
    featureMutation = useCommunityCommentFeature(postId),
    blockMutation = useCommunityUserBlock(postId, userId),
    safetyMutation = useCheckCommunityCommentSafety();
  const [body, setBody] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [replying, setReplying] = useState<CommunityComment | null>(null);
  const [editing, setEditing] = useState<CommunityComment | null>(null),
    [editBody, setEditBody] = useState(""),
    [pendingDelete, setPendingDelete] = useState<CommunityComment | null>(null);
  const [sort, setSort] = useState<"relevant" | "newest" | "oldest">(
      "relevant",
    ),
    [revealed, setRevealed] = useState(() => new Set<string>()),
    [warnConfirmedBody, setWarnConfirmedBody] = useState<string | null>(null);
  const mentionQuery = mentionTail(body),
    mentions = useCommunityMentionUsers(mentionQuery);

  const comments = useMemo(() => {
    const rows = [...(query.data ?? [])].filter((comment) => expanded || comment.status === "visible");
    const score = (item: CommunityComment) =>
      (item.is_pinned ? 100000 : 0) +
      (item.is_best_answer ? 50000 : 0) +
      item.like_count * 4 +
      (item.profiles?.is_verified ? 2 : 0) -
      ((Date.now() - Date.parse(item.created_at)) / 86_400_000) * 0.05;
    const relationshipPriority = (a: CommunityComment, b: CommunityComment) =>
      Number(Boolean(b.viewer_is_followed_or_friend)) - Number(Boolean(a.viewer_is_followed_or_friend));
    if (sort === "newest")
      rows.sort((a, b) => relationshipPriority(a,b) || Date.parse(b.created_at) - Date.parse(a.created_at));
    else if (sort === "oldest")
      rows.sort((a, b) => relationshipPriority(a,b) || Date.parse(a.created_at) - Date.parse(b.created_at));
    else rows.sort((a, b) => relationshipPriority(a,b) || score(b) - score(a));
    const children = new Map<string, CommunityComment[]>();
    for (const row of rows)
      if (row.parent_comment_id)
        children.set(row.parent_comment_id, [
          ...(children.get(row.parent_comment_id) ?? []),
          row,
        ]);
    return {
      roots: rows.filter(
        (row) =>
          !row.parent_comment_id ||
          !rows.some((candidate) => candidate.id === row.parent_comment_id),
      ),
      children,
    };
  }, [expanded, query.data, sort]);

  const chooseFiles = (selected: FileList | null) => {
    const next = [...(selected ?? [])].slice(0, 3);
    if (next.some((file) => file.size > 10 * 1024 * 1024)) {
      toast.error("Each attachment must be 10 MB or smaller.");
      return;
    }
    if (
      next.some(
        (file) =>
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "application/pdf",
          ].includes(file.type),
      )
    ) {
      toast.error("Only JPG, PNG, WebP, GIF, and PDF files are supported.");
      return;
    }
    setFiles(next);
  };
  const submit = async () => {
    const value = body.trim();
    if (!value) return;
    try {
      const safety = await safetyMutation.mutateAsync(value);
      if (safety === "warn" && warnConfirmedBody !== value) {
        setWarnConfirmedBody(value);
        toast.warning("Review this language, then submit again to continue.");
        return;
      }
      const result = await createMutation.mutateAsync({
        body: value,
        parentCommentId: replying?.id,
        files,
      });
      setBody("");
      setFiles([]);
      setReplying(null);
      setWarnConfirmedBody(null);
      toast[
        result.status === "hidden"
          ? "warning"
          : result.status === "collapsed"
            ? "info"
            : "success"
      ](
        result.status === "hidden"
          ? "Comment hidden by safety rules."
          : result.status === "collapsed"
            ? "Comment published in a collapsed state."
            : "Comment published.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Comment could not be submitted.",
      );
    }
  };
  const saveEdit = async () => {
    if (!editing || !editBody.trim()) return;
    try {
      await updateMutation.mutateAsync({
        commentId: editing.id,
        body: editBody.trim(),
      });
      setEditing(null);
      toast.success("Comment updated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Comment could not be updated.",
      );
    }
  };
  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      toast.success("Comment removed. An administrator can restore it.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Comment could not be deleted.",
      );
    }
  };
  const feature = async (
    comment: CommunityComment,
    type: "pinned" | "best_answer",
    enabled: boolean,
  ) => {
    try {
      await featureMutation.mutateAsync({
        commentId: comment.id,
        feature: type,
        enabled,
      });
      toast.success(
        type === "pinned" ? "Pin updated." : "Best answer updated.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Comment feature could not be updated.",
      );
    }
  };

  const renderComment = (
    comment: CommunityComment,
    depth = 0,
  ): React.ReactNode => {
    const name =
        comment.profiles?.full_name ||
        comment.profiles?.name ||
        "Community member",
      isOwner = comment.author_id === userId,
      canCurate = userId === postAuthorId;
    return (
      <div
        key={comment.id}
        className={depth ? "ml-5 border-l border-border pl-4 sm:ml-10" : ""}
      >
        <article className="flex gap-3 rounded-xl bg-muted/45 p-4">
          <UserAvatar
            name={name}
            avatarUrl={comment.profiles?.avatar_url}
            size={34}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{name}</p>
              {comment.profiles?.is_verified && (
                <GraduationCap className="size-4 text-primary" />
              )}
              {comment.is_pinned && (
                <Badge variant="outline">
                  <Pin className="mr-1 size-3" />
                  Pinned
                </Badge>
              )}
              {comment.is_best_answer && (
                <Badge>
                  <Award className="mr-1 size-3" />
                  Best answer
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {commentDate(comment.created_at)}
              </span>
            </div>
            {editing?.id === comment.id ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  maxLength={5000}
                  className="resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    <X />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void saveEdit()}>
                    <Check />
                    Save
                  </Button>
                </div>
              </div>
            ) : comment.status === "collapsed" && !revealed.has(comment.id) ? (
              <div className="mt-2 rounded-lg border border-amber-500/25 p-3">
                <p className="flex items-center gap-2 text-sm">
                  <ShieldAlert className="size-4" />
                  Potentially sensitive comment
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() =>
                    setRevealed((current) => new Set(current).add(comment.id))
                  }
                >
                  Show comment
                </Button>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {comment.body}
              </p>
            )}
            {comment.media.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {comment.media.map((media) =>
                  media.mime_type.startsWith("image/") ? (
                    <a
                      key={media.id}
                      href={media.public_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={media.public_url}
                        alt={media.file_name}
                        className="h-24 max-w-40 rounded-lg object-cover"
                      />
                    </a>
                  ) : (
                    <a
                      key={media.id}
                      href={media.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                    >
                      <FileText className="size-4" />
                      {media.file_name}
                    </a>
                  ),
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={comment.viewer_has_liked}
                disabled={!userId || likeMutation.isPending}
                onClick={() =>
                  void likeMutation.mutateAsync({
                    commentId: comment.id,
                    active: !comment.viewer_has_liked,
                  })
                }
              >
                <Heart
                  className={
                    comment.viewer_has_liked ? "fill-current text-rose-500" : ""
                  }
                />
                {comment.like_count}
              </Button>
              {userId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplying(comment);
                    setBody(
                      `@${comment.profiles?.username ?? ""} `.trimStart(),
                    );
                  }}
                >
                  <Reply />
                  Reply
                </Button>
              )}
              {canCurate && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void feature(comment, "pinned", !comment.is_pinned)
                    }
                  >
                    <Pin />
                    {comment.is_pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void feature(
                        comment,
                        "best_answer",
                        !comment.is_best_answer,
                      )
                    }
                  >
                    <Award />
                    {comment.is_best_answer ? "Unmark" : "Best answer"}
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            {isOwner && editing?.id !== comment.id && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit comment"
                  onClick={() => {
                    setEditing(comment);
                    setEditBody(comment.body);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete comment"
                  onClick={() => setPendingDelete(comment)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
            {userId && !isOwner && (
              <>
                <CommunityReportDialog
                  userId={userId}
                  commentId={comment.id}
                  targetName="comment"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Block ${name}`}
                  disabled={blockMutation.isPending}
                  onClick={() =>
                    void blockMutation
                      .mutateAsync({
                        blockedUserId: comment.author_id,
                        active: true,
                      })
                      .then(() => toast.success(`${name} blocked.`))
                      .catch((error) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not block user.",
                        ),
                      )
                  }
                >
                  <UserX />
                </Button>
              </>
            )}
          </div>
        </article>
        {(comments.children.get(comment.id) ?? []).map((child) =>
          renderComment(child, depth + 1),
        )}
      </div>
    );
  };

  return (
    <section
      className="mt-4 border-t border-border/70 pt-4"
      aria-label="Comments"
    >
      {expanded && (userId ? (
        <form
          noValidate
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {replying && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
              Replying to{" "}
              {replying.profiles?.full_name || replying.profiles?.name}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel reply"
                onClick={() => setReplying(null)}
              >
                <X />
              </Button>
            </div>
          )}
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setWarnConfirmedBody(null);
            }}
            maxLength={5000}
            placeholder="Add a clinical comment… Use @username to mention someone."
            className="min-h-24 resize-none"
          />
          {mentionQuery && mentions.data && mentions.data.length > 0 && (
            <div className="rounded-lg border bg-popover p-1">
              {mentions.data.map((person) => (
                <Button
                  key={person.user_id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() =>
                    setBody((current) =>
                      current.replace(
                        /@([a-zA-Z0-9_.-]*)$/,
                        `@${person.username} `,
                      ),
                    )
                  }
                >
                  @{person.username} · {person.full_name || person.name}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Paperclip className="size-4" />
              Attach up to 3 files
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="sr-only"
                onChange={(e) => chooseFiles(e.target.files)}
              />
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={!body.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Publishing…" : "Publish"}
            </Button>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file) => (
                <Badge key={file.name} variant="secondary">
                  {file.type.startsWith("image/") ? (
                    <Image className="mr-1 size-3" />
                  ) : (
                    <FileText className="mr-1 size-3" />
                  )}
                  {file.name}
                </Badge>
              ))}
            </div>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in to join the discussion.
        </p>
      ))}
      {expanded && <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <form
          noValidate
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
          }}
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search comments"
            className="pl-9"
          />
        </form>
        <Select
          value={sort}
          onValueChange={(value) => setSort(value as typeof sort)}
        >
          <SelectTrigger className="sm:w-40" aria-label="Sort comments">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevant">Most relevant</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>}
      {query.isLoading && (
        <div className="flex min-h-32 items-center justify-center">
          <LoadingSpinner />
        </div>
      )}
      {query.isError && <RetryCard onRetry={() => void query.refetch()} />}{" "}
      {expanded && !query.isLoading && !query.isError && comments.roots.length === 0 && (
        <EmptyState
          title="No comments found"
          description={
            search
              ? "Try another search."
              : "Start a thoughtful clinical discussion."
          }
        />
      )}
      <div className="mt-4 space-y-3">
        {comments.roots.map((comment) => renderComment(comment))}
      </div>
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove comment?</DialogTitle>
            <DialogDescription>
              The comment becomes hidden but can be restored by an
              administrator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={() => void remove()}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
