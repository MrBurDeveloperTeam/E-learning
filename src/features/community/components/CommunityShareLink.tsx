import { Copy, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CommunitySummary } from '@/features/community/types'

export function CommunityShareLink({ community }: { community: Pick<CommunitySummary, 'name' | 'slug' | 'visibility'> }) {
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/community?tab=communities&invite=${encodeURIComponent(community.slug)}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Community invite link copied.')
    } catch {
      toast.error('The invite link could not be copied.')
    }
  }

  return <section className="rounded-2xl border bg-card p-4">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4 text-primary" />Share community</h3>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{community.visibility === 'public' ? 'Anyone signed in can use this link to join immediately.' : 'People using this link must send a request for the owner to approve.'}</p>
    <div className="mt-3 flex gap-2"><Input value={link} readOnly aria-label={`${community.name} invite link`} className="min-w-0" /><Button type="button" variant="outline" onClick={() => void copy()}><Copy />Copy</Button></div>
  </section>
}
