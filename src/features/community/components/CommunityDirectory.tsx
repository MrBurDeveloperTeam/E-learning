import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
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
} from "@/features/community/components/CommunityDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/community/components/CommunityDialog";
import { CommunityConfirmAction } from "@/features/community/components/CommunityConfirmAction";
import { browseCommunities, fetchCommunityInvitePreview, searchJoinableCommunities, type CommunitySearchResult } from "@/features/community/api/communityApi";

type DirectoryTab = "public" | "private" | "joined";

function DiscoveryCommunityTile({ community, userId, onView }: { community: CommunitySearchResult; userId: string; onView: (community: CommunitySearchResult) => void }) {
  const join = useJoinPublicCommunity(userId)
  return <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
    <div className="flex items-start gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">{community.visibility === 'private' ? <LockKeyhole className="size-5" /> : <Globe2 className="size-5" />}</div><div className="min-w-0 flex-1"><h3 className="font-semibold">{community.name}</h3><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{community.description || 'A dental Community for sharing knowledge and discussion.'}</p><div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize">{community.visibility}</span><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><UsersRound className="size-3.5" />{community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}</span>{community.visibility === 'public' ? <Button size="sm" variant="secondary" className="ml-auto" render={<Link to="/community/$communitySlug" params={{ communitySlug: community.slug }} />}>View community</Button> : <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onView(community)}>View</Button>}{community.visibility === 'public' && !community.viewerIsMember && <Button size="sm" disabled={join.isPending} onClick={() => void join.mutateAsync(community.id).then(() => toast.success(`Joined ${community.name}.`)).catch(error => toast.error(error instanceof Error ? error.message : 'Could not join this Community.'))}>{join.isPending ? 'Joining…' : 'Join'}</Button>}</div></div></div>
  </article>
}

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
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
              {community.visibility}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <UsersRound className="size-3.5" /> {community.member_count}{" "}
              {community.member_count === 1 ? "member" : "members"}
            </span>
            {community.status !== "archived" && (community.viewer_is_member ? (
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
            ) : null)}
            {community.viewer_is_member && (community.status === "active" || community.status === "archived") && (
              <Button size="sm" variant="secondary" render={<Link to="/community/$communitySlug" params={{ communitySlug: community.slug }} />}>
                {community.status === "archived" ? "View history" : "Open community"}
              </Button>
            )}
            {community.status === "archived" && <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Deleted · read-only</span>}
            {community.status === "pending_review" && (
              <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
                Pending admin review
              </span>
            )}
            {community.status !== "archived" && community.owner_id !== userId && (
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
  const inviteJoin = useJoinPublicCommunity(userId);
  const requestPrivate = useRequestPrivateCommunityJoin();
  const [createOpen, setCreateOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState<"public" | "private">("public");
  const [joinOpen, setJoinOpen] = useState(false),
    [privateSlug, setPrivateSlug] = useState(""),
    [joinMessage, setJoinMessage] = useState("");
  const [inviteSlugLocked, setInviteSlugLocked] = useState(false);
  const [inviteCommunityName, setInviteCommunityName] = useState("");
  const [communitySearch, setCommunitySearch] = useState("");
  const [communitySearchResults, setCommunitySearchResults] = useState<CommunitySearchResult[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunitySearchResult | null>(null);
  const [communitySearchLoading, setCommunitySearchLoading] = useState(false);
  const [communitySearchError, setCommunitySearchError] = useState("");
  const [browseResults, setBrowseResults] = useState<CommunitySearchResult[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const communities = directory.data ?? [];
  const processedInvite = useRef<string | null>(null);
  useEffect(() => {
    if (directory.isLoading || directory.isError) return
    const invite = new URLSearchParams(window.location.search).get('invite')?.trim().toLowerCase()
    if (!invite || processedInvite.current === invite) return
    processedInvite.current = invite
    const publicCommunity = communities.find(community => community.slug === invite && community.visibility === 'public' && community.status === 'active')
    if (!publicCommunity) {
      setPrivateSlug(invite)
      setInviteSlugLocked(true)
      setInviteCommunityName('')
      setJoinOpen(true)
      void fetchCommunityInvitePreview(invite)
        .then(preview => setInviteCommunityName(preview.name))
        .catch(() => setInviteCommunityName('Private Community'))
      return
    }
    if (publicCommunity.viewer_is_member) {
      window.location.assign(`/community/${encodeURIComponent(publicCommunity.slug)}`)
      return
    }
    void inviteJoin.mutateAsync(publicCommunity.id)
      .then(() => {
        toast.success(`Joined ${publicCommunity.name}.`)
        window.location.assign(`/community/${encodeURIComponent(publicCommunity.slug)}`)
      })
      .catch((error: unknown) => {
        processedInvite.current = null
        toast.error(error instanceof Error ? error.message : 'Could not join this Community.')
      })
  }, [communities, directory.isError, directory.isLoading, inviteJoin])
  useEffect(() => {
    if (inviteSlugLocked || !joinOpen || communitySearch.trim().length < 2) {
      setCommunitySearchResults([])
      setCommunitySearchError('')
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      setCommunitySearchLoading(true)
      void searchJoinableCommunities(communitySearch)
        .then(results => { if (active) setCommunitySearchResults(results) })
        .catch(() => { if (active) setCommunitySearchError('Communities could not be searched. Please try again.') })
        .finally(() => { if (active) setCommunitySearchLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [communitySearch, inviteSlugLocked, joinOpen])
  useEffect(() => {
    if (tab === 'joined') return
    let active = true
    setBrowseLoading(true)
    setBrowseError(false)
    void browseCommunities(tab)
      .then(results => { if (active) setBrowseResults(results) })
      .catch(() => { if (active) setBrowseError(true) })
      .finally(() => { if (active) setBrowseLoading(false) })
    return () => { active = false }
  }, [tab])
  const visibleCommunities = communities.filter((community) => community.viewer_is_member).filter((community) =>
    `${community.name} ${community.description ?? ""}`
      .toLowerCase()
      .includes(directorySearch.trim().toLowerCase()),
  );
  const visibleBrowseResults = browseResults.filter(community =>
    `${community.name} ${community.description ?? ''}`.toLowerCase().includes(directorySearch.trim().toLowerCase()),
  );

  return (
    <section className="mt-7">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger render={<Button variant="outline" onClick={() => { setInviteSlugLocked(false); setInviteCommunityName(''); setPrivateSlug(''); setJoinMessage(''); setCommunitySearch(''); setSelectedCommunity(null) }} />}>
            <Search />
            Find community
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{inviteSlugLocked ? 'Request to join a private community' : selectedCommunity ? selectedCommunity.name : 'Find a community'}</DialogTitle>
              <DialogDescription>
                {inviteSlugLocked ? 'This is a private Community. Send a request and wait for the owner to approve it.' : selectedCommunity ? `${selectedCommunity.visibility === 'public' ? 'Public' : 'Private'} Community · ${selectedCommunity.memberCount} ${selectedCommunity.memberCount === 1 ? 'member' : 'members'}` : 'Search by Community name, then view it before joining or requesting access.'}
              </DialogDescription>
            </DialogHeader>
            {inviteSlugLocked ? <div className="rounded-lg border bg-muted/60 px-3 py-2.5" aria-label="Invited Community"><p className="text-xs text-muted-foreground">Community</p><p className="mt-0.5 font-medium">{inviteCommunityName || 'Loading Community…'}</p></div> : selectedCommunity ? <div className="space-y-4">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => { setSelectedCommunity(null); setJoinMessage('') }}><ArrowLeft />Back to results</Button>
              <div className="rounded-xl border p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{selectedCommunity.visibility === 'private' ? <LockKeyhole className="size-5" /> : <Globe2 className="size-5" />}</div><div><p className="font-semibold">{selectedCommunity.name}</p><p className="text-xs capitalize text-muted-foreground">{selectedCommunity.visibility} Community</p></div></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{selectedCommunity.description || 'No description has been provided.'}</p></div>
            </div> : <div className="space-y-3">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={communitySearch} className="pl-9" autoFocus placeholder="Search Community name" onChange={event => { setCommunitySearch(event.target.value); setCommunitySearchError('') }} /></div>
              <div className="max-h-72 space-y-2 overflow-y-auto">{communitySearchLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : communitySearchError ? <p className="py-6 text-center text-sm text-destructive">{communitySearchError}</p> : communitySearch.trim().length < 2 ? <p className="py-6 text-center text-sm text-muted-foreground">Enter at least 2 characters.</p> : communitySearchResults.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No matching Communities found.</p> : communitySearchResults.map(result => <button key={result.id} type="button" className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted" onClick={() => { setSelectedCommunity(result); setPrivateSlug(result.slug) }}><div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{result.visibility === 'private' ? <LockKeyhole className="size-4" /> : <Globe2 className="size-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{result.name}</p><p className="text-xs capitalize text-muted-foreground">{result.visibility} · {result.memberCount} {result.memberCount === 1 ? 'member' : 'members'}</p></div><ChevronRight className="size-4 text-muted-foreground" /></button>)}</div>
            </div>}
            {inviteSlugLocked && <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" />This Community was set by the invitation link and cannot be changed.</p>}
            {(inviteSlugLocked || selectedCommunity?.visibility === 'private') && <Textarea
              value={joinMessage}
              maxLength={500}
              className="resize-none"
              onChange={(event) => setJoinMessage(event.target.value)}
              placeholder="Introduce yourself (optional)"
            />}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              {(inviteSlugLocked || (selectedCommunity?.visibility === 'private' && !selectedCommunity.viewerIsMember)) && <Button
                disabled={!privateSlug.trim() || requestPrivate.isPending}
                onClick={() =>
                  void requestPrivate
                    .mutateAsync({ slug: privateSlug, message: joinMessage })
                    .then(() => {
                      setJoinOpen(false);
                      setPrivateSlug("");
                      setJoinMessage("");
                      setInviteSlugLocked(false);
                      setInviteCommunityName("");
                      const nextUrl = new URL(window.location.href);
                      nextUrl.searchParams.delete('invite');
                      window.history.replaceState({}, '', nextUrl);
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
              </Button>}
              {!inviteSlugLocked && selectedCommunity?.viewerIsMember && <Button render={<Link to="/community/$communitySlug" params={{ communitySlug: selectedCommunity.slug }} />}>Open community</Button>}
              {!inviteSlugLocked && selectedCommunity?.visibility === 'public' && !selectedCommunity.viewerIsMember && <Button variant="outline" render={<Link to="/community/$communitySlug" params={{ communitySlug: selectedCommunity.slug }} />}>View community</Button>}
              {!inviteSlugLocked && selectedCommunity?.visibility === 'public' && !selectedCommunity.viewerIsMember && <Button disabled={inviteJoin.isPending} onClick={() => void inviteJoin.mutateAsync(selectedCommunity.id).then(() => { toast.success(`Joined ${selectedCommunity.name}.`); window.location.assign(`/community/${encodeURIComponent(selectedCommunity.slug)}`) }).catch(error => toast.error(error instanceof Error ? error.message : 'Could not join this Community.'))}>{inviteJoin.isPending ? 'Joining…' : 'Join community'}</Button>}
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
            ["private", "Private"],
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

      {directory.isLoading || (tab !== 'joined' && browseLoading) ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : directory.isError || (tab !== 'joined' && browseError) ? (
        <div className="mt-4">
          <RetryCard onRetry={() => void directory.refetch()} />
        </div>
      ) : (tab === 'joined' ? visibleCommunities : visibleBrowseResults).length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card">
          <EmptyState
            icon={tab === "joined" ? <UsersRound /> : tab === 'private' ? <LockKeyhole /> : <Globe2 />}
            title={
              tab === "joined"
                ? "You have not joined a community yet"
                : `No ${tab} Communities yet`
            }
            description={
              tab === "joined"
                ? "Browse Public and join a community to see it here."
                : `Active ${tab} Communities will appear here.`
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {tab === 'joined' ? visibleCommunities.map((community) => (
            <CommunityTile
              key={community.id}
              community={community}
              userId={userId}
            />
          )) : visibleBrowseResults.map(community => <DiscoveryCommunityTile key={community.id} community={community} userId={userId} onView={result => { setInviteSlugLocked(false); setSelectedCommunity(result); setPrivateSlug(result.slug); setJoinMessage(''); setJoinOpen(true) }} />)}
        </div>
      )}
    </section>
  );
}
