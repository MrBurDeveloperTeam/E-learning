import { CheckCircle2, Clock3, CircleX, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CommunityAppeal } from '@/features/community/api/communityReleaseApi'

const states = {
  pending: { label: 'Pending review', icon: Clock3, tone: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2, tone: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-200' },
  rejected: { label: 'Rejected', icon: CircleX, tone: 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200' },
  withdrawn: { label: 'Withdrawn', icon: RotateCcw, tone: 'border-border bg-muted/60 text-muted-foreground' },
} as const

export function CommunityAppealStatus({ status }: { status: CommunityAppeal['status'] }) {
  const { label, icon: Icon, tone } = states[status]
  return <Badge variant="outline" className={`h-7 gap-1.5 rounded-full px-3 text-xs font-semibold ${tone}`}>
    <Icon aria-hidden="true" className="size-3.5" />{label}
  </Badge>
}
