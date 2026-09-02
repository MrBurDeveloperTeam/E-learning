import { UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useCommunityBlockedUsers,useUnblockCommunityUser } from '@/features/community/hooks/useCommunity'

export function CommunityBlockedUsers({userId}:{userId:string}){
  const query=useCommunityBlockedUsers(userId),mutation=useUnblockCommunityUser(userId)
  if(query.isLoading)return <div className="flex min-h-48 items-center justify-center"><LoadingSpinner/></div>
  if(!query.data?.length)return <div className="mt-6"><EmptyState icon={<UserX/>} title="No blocked users" description="People you block will appear here."/></div>
  return <div className="mt-5 space-y-3">{query.data.map(person=>{const name=person.full_name||person.name||'Community member';return <div key={person.user_id} className="flex items-center gap-3 rounded-2xl border p-4"><UserAvatar name={name} avatarUrl={person.avatar_url} size={42}/><p className="min-w-0 flex-1 truncate font-semibold">{name}</p><Button variant="outline" size="sm" disabled={mutation.isPending} onClick={()=>void mutation.mutateAsync(person.user_id).then(()=>toast.success(`${name} unblocked.`)).catch(error=>toast.error(error instanceof Error?error.message:'Could not unblock user.'))}>Unblock</Button></div>})}</div>
}
