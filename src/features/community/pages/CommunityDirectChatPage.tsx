import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, MessageCircleMore } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { DirectMessages } from '@/features/community/components/DirectMessages'
import { useDirectConversations } from '@/features/community/hooks/useCommunity'
import { useAuthStore } from '@/store/authStore'

export function CommunityDirectChatPage() {
  const { conversationId } = useParams({ from: '/community/chat/$conversationId' })
  const user = useAuthStore((state) => state.user)
  const conversations = useDirectConversations(user?.id)
  const conversation = conversations.data?.find((item) => item.id === conversationId)

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <div className="hidden md:block"><Navbar /></div>
      <main className="min-h-0 flex-1 md:mx-auto md:w-full md:max-w-5xl md:p-6">
        {conversations.isLoading ? (
          <div className="flex h-full items-center justify-center" role="status" aria-label="Loading conversation"><LoadingSpinner size="lg" /></div>
        ) : conversations.isError ? (
          <div className="mx-auto max-w-xl p-4"><RetryCard onRetry={() => void conversations.refetch()} /></div>
        ) : !conversation || !user ? (
          <div className="mx-auto max-w-xl p-4">
            <Link to="/community" search={{ tab: 'chat', q: undefined, topic: undefined, sort: undefined }} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to chats
            </Link>
            <EmptyState icon={<MessageCircleMore />} title="Chat unavailable" description="This conversation may have been removed. Choose another chat from your list." />
          </div>
        ) : (
          <DirectMessages userId={user.id} conversations={conversations.data} initialConversationId={conversationId} conversationOnly />
        )}
      </main>
    </div>
  )
}
