import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Search, UserPlus, UsersRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RetryCard } from '@/components/shared/RetryCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useCommunityPeopleSearch, useFollowCommunityPerson } from '@/features/community/hooks/useCommunity'

export function FindPeopleDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const peopleQuery = useCommunityPeopleSearch(userId, committedQuery)
  const followMutation = useFollowCommunityPerson(userId)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setCommittedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [open, query])

  const clearSearch = () => {
    setQuery('')
    setCommittedQuery('')
    inputRef.current?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlus className="size-4" />
        Find people
      </DialogTrigger>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <UsersRound className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg">Find people to follow</DialogTitle>
              <DialogDescription className="mt-1">Search Community members by their name or username.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative px-5 pt-1 sm:px-6">
          <Search className="absolute left-8 top-1/2 size-4 -translate-y-1/2 text-muted-foreground sm:left-9" />
          <Input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members…"
            aria-label="Search Community members"
            className="pl-9 pr-10"
          />
          {query && (
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Clear member search" className="absolute right-6 top-1/2 -translate-y-1/2 sm:right-7" onClick={clearSearch}>
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="min-h-52 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6" aria-live="polite">
          {!query.trim() && <EmptyState icon={<UsersRound />} title="Search the Community" description="Enter a name or username to find someone." />}
          {query.trim().length === 1 && <p className="pt-5 text-sm text-muted-foreground">Enter at least 2 characters.</p>}
          {committedQuery.length >= 2 && peopleQuery.isLoading && <div className="flex min-h-52 items-center justify-center"><LoadingSpinner /></div>}
          {committedQuery.length >= 2 && peopleQuery.isError && <div className="pt-4"><RetryCard onRetry={() => void peopleQuery.refetch()} /></div>}
          {committedQuery.length >= 2 && !peopleQuery.isLoading && !peopleQuery.isError && peopleQuery.data?.length === 0 && (
            <EmptyState icon={<Search />} title="No matching members" description="Try another name or username." />
          )}
          {committedQuery.length >= 2 && peopleQuery.data && peopleQuery.data.length > 0 && (
            <div className="divide-y divide-border pt-2">
              {peopleQuery.data.map((person) => {
                const name = person.full_name || person.name || 'Community member'
                return (
                  <div key={person.user_id} className="flex items-center gap-3 py-3">
                    <Link to="/profile/$userId" params={{ userId: person.user_id }} onClick={() => setOpen(false)} aria-label={`View ${name}'s profile`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
                      <UserAvatar name={name} avatarUrl={person.avatar_url} size={42} />
                      <div className="min-w-0 flex-1 py-1">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        {person.username && <p className="truncate text-xs text-muted-foreground">@{person.username}</p>}
                      </div>
                    </Link>
                    <Button
                      size="sm"
                      variant={person.viewer_is_following || person.viewer_request_pending ? 'outline' : 'default'}
                      disabled={person.viewer_is_following || person.viewer_request_pending || followMutation.isPending}
                      onClick={() => void followMutation.mutateAsync(person.user_id).then((status) => toast.success(status === 'request_pending' ? 'Follow request sent.' : 'Following.')).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not follow this member.'))}
                    >
                      {person.viewer_is_following ? <><Check className="size-4" />Following</> : person.viewer_request_pending ? <><Check className="size-4" />Requested</> : <><UserPlus className="size-4" />{person.profile_visibility === 'private' ? 'Request' : 'Follow'}</>}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
