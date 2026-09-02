import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Globe2,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RetryCard } from "@/components/shared/RetryCard";
import {
  useCommunityDirectory,
  useCreateCommunity,
  useJoinPublicCommunity,
  useLeaveCommunity,
  useRequestPrivateCommunityJoin,
} from "@/features/community/hooks/useCommunity";
import type { CommunitySummary } from "@/features/community/types";
import { cn } from "@/lib/utils";
import { CommunityReportDialog } from "@/features/community/components/CommunityReportDialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommunityConfirmAction } from "@/features/community/components/CommunityConfirmAction";
import { CommunityAppealDialog } from "@/features/community/components/CommunityAppealDialog";

type DirectoryTab = "public" | "joined";

function CommunityTile({
  community,
  userId,
}: {
  community: CommunitySummary;
  userId: string;
}) {
  const join = useJoinPublicCommunity(userId);
  const leave = useLeaveCommunity(userId);

  async function handleJoin() {
    try {
      await join.mutateAsync(community.id);
      toast.success(`Joined ${community.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not join this community.",
      );
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          {community.visibility === "private" ? (
            <LockKeyhole className="size-5" />
          ) : (
            <Globe2 className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-[-0.02em] text-foreground">
              <Link
                to="/community/$communitySlug"
                params={{ communitySlug: community.slug }}
                className="rounded-sm hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {community.name}
              </Link>
            </h3>
            {community.viewer_membership_role === "owner" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <ShieldCheck className="size-3" /> Owner
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {community.description ||
              "A dental community for sharing knowledge and discussion."}
          </p>
          {community.viewer_is_member && community.announcement && (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Announcement
              </p>
              <p className="mt-1 text-sm leading-6">{community.announcement}</p>
            </div>
          )}
          {community.viewer_is_member && community.rules.length > 0 && (
            <details className="mt-3 rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Community rules ({community.rules.length})
              </summary>
              <ol className="mt-2 space-y-2 pl-5 text-sm text-muted-foreground">
                {community.rules.map((rule) => (
                  <li key={rule.id} className="list-decimal">
                    <span className="font-medium text-foreground">
                      {rule.title}
                    </span>
                    {rule.description && (
                      <p className="text-xs leading-5">{rule.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <UsersRound className="size-3.5" /> {community.member_count}{" "}
              {community.member_count === 1 ? "member" : "members"}
            </span>
            <span className="text-xs capitalize text-muted-foreground">
              {community.visibility}
            </span>
            {community.viewer_is_member ? (
              community.viewer_membership_role !== "owner" ? (
                <CommunityConfirmAction
                  trigger={
                    <Button size="sm" variant="outline">
                      Leave
                    </Button>
                  }
                  title={`Leave ${community.name}?`}
                  description="You will lose access to private posts in this community. A private community may require approval to rejoin."
                  label="Leave community"
                  onConfirm={() =>
                    leave
                      .mutateAsync(community.id)
                      .then(() => toast.success(`Left ${community.name}.`))
                  }
                />
              ) : null
            ) : community.visibility === "public" ? (
              <Button
                size="sm"
                className="ml-auto min-w-20"
                disabled={join.isPending}
                onClick={() => void handleJoin()}
              >
                {join.isPending ? "Joining…" : "Join"}
              </Button>
            ) : null}
            {community.viewer_is_member && community.status === "active" && (
              <Button size="sm" variant="secondary" render={<Link to="/community/$communitySlug" params={{ communitySlug: community.slug }} />}>
                Open community
              </Button>
            )}
            {community.status === "pending_review" && (
              <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
                Pending admin review
              </span>
            )}
            {community.viewer_membership_role === "owner" &&
              (community.status === "rejected" ||
                community.status === "hidden") && (
                <CommunityAppealDialog
                  userId={userId}
                  communityId={community.id}
                  targetLabel={community.name}
                />
              )}
            {community.owner_id !== userId && (
              <CommunityReportDialog
                userId={userId}
                communityId={community.id}
                targetName={community.name}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function CommunityDirectory({ userId }: { userId: string }) {
  const [tab, setTab] = useState<DirectoryTab>("public");
  const directory = useCommunityDirectory(userId);
  const create = useCreateCommunity(userId);
  const requestPrivate = useRequestPrivateCommunityJoin();
  const [createOpen, setCreateOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState<"public" | "private">("public");
  const [joinOpen, setJoinOpen] = useState(false),
    [privateSlug, setPrivateSlug] = useState(""),
    [joinMessage, setJoinMessage] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const communities = directory.data ?? [];
  const visibleCommunities = (
    tab === "public"
      ? communities.filter((community) => community.visibility === "public")
      : communities.filter((community) => community.viewer_is_member)
  ).filter((community) =>
    `${community.name} ${community.description ?? ""}`
      .toLowerCase()
      .includes(directorySearch.trim().toLowerCase()),
  );

  return (
    <section className="mt-7">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <LockKeyhole />
            Join private
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request to join a private community</DialogTitle>
              <DialogDescription>
                Enter the community slug shared by its owner. The owner must
                approve your request.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={privateSlug}
              onChange={(event) => setPrivateSlug(event.target.value)}
              placeholder="community-slug"
            />
            <Textarea
              value={joinMessage}
              maxLength={500}
              className="resize-none"
              onChange={(event) => setJoinMessage(event.target.value)}
              placeholder="Introduce yourself (optional)"
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                disabled={!privateSlug.trim() || requestPrivate.isPending}
                onClick={() =>
                  void requestPrivate
                    .mutateAsync({ slug: privateSlug, message: joinMessage })
                    .then(() => {
                      setJoinOpen(false);
                      setPrivateSlug("");
                      setJoinMessage("");
                      toast.success(
                        "Join request sent to the community owner.",
                      );
                    })
                    .catch((error) =>
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not send request.",
                      ),
                    )
                }
              >
                {requestPrivate.isPending ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus />
            Create community
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create community</DialogTitle>
              <DialogDescription>
                New communities are submitted to an administrator before
                becoming active.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Community name"
            />
            <Textarea
              value={description}
              maxLength={2000}
              className="resize-none"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this community for?"
            />
            <Select
              value={visibility}
              onValueChange={(value) =>
                setVisibility(value as "public" | "private")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  Public — anyone can discover and join
                </SelectItem>
                <SelectItem value="private">
                  Private — approved members only
                </SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                disabled={name.trim().length < 2 || create.isPending}
                onClick={() =>
                  void create
                    .mutateAsync({ name, description, visibility })
                    .then(() => {
                      setCreateOpen(false);
                      setName("");
                      setDescription("");
                      toast.success("Community submitted for admin review.");
                    })
                    .catch((error) =>
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not create community.",
                      ),
                    )
                }
              >
                {create.isPending ? "Submitting…" : "Submit for review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div
        className="flex gap-1 rounded-xl border border-border bg-card p-1"
        role="tablist"
        aria-label="Community sections"
      >
        {(
          [
            ["public", "Public"],
            ["joined", "Joined"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={directorySearch}
            className="pl-9 pr-9"
            placeholder="Search communities"
            onChange={(event) => setDirectorySearch(event.target.value)}
          />
          {directorySearch && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Clear community search"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setDirectorySearch("")}
            >
              <X />
            </Button>
          )}
      </div>

      {directory.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : directory.isError ? (
        <div className="mt-4">
          <RetryCard onRetry={() => void directory.refetch()} />
        </div>
      ) : visibleCommunities.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card">
          <EmptyState
            icon={tab === "joined" ? <UsersRound /> : <Globe2 />}
            title={
              tab === "joined"
                ? "You have not joined a community yet"
                : "No public communities yet"
            }
            description={
              tab === "joined"
                ? "Browse Public and join a community to see it here."
                : "Approved public communities will appear here."
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {visibleCommunities.map((community) => (
            <CommunityTile
              key={community.id}
              community={community}
              userId={userId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
