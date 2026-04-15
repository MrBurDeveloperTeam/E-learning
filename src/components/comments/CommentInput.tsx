import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useCreateComment } from '@/hooks/useComments'
import { getDisplayName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface CommentInputProps {
  videoId: string
  parentId?: string
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentInput({
  videoId,
  parentId,
  onCancel,
  placeholder,
  autoFocus = false,
}: CommentInputProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const session = useAuthStore((state) => state.session)
  const createComment = useCreateComment()
  const [body, setBody] = useState('')
  const [isFocused, setIsFocused] = useState(autoFocus)
  const avatarName = getDisplayName(
    {
      ...profile,
      email: user?.email ?? null,
    },
    'User'
  )

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || !user?.id) return

    await createComment.mutateAsync({
      video_id: videoId,
      author_id: user.id,
      body: trimmed,
      parent_id: parentId,
    })

    setBody('')
    setIsFocused(false)
    onCancel?.()
  }

  if (!session) {
    return (
      <div className="flex items-center gap-3 py-3">
        <div
          className="flex-1 cursor-pointer rounded-xl bg-[#EDF2F2] px-4 py-2.5 text-sm text-[#9BB5B5]"
          onClick={() => navigate({ to: '/login' })}
        >
          Sign in to comment...
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <UserAvatar
        name={avatarName}
        avatarUrl={profile?.avatar_url}
        size={32}
      />
      <div className="flex-1">
        <textarea
          className="input-field w-full resize-none"
          rows={parentId ? 2 : 3}
          placeholder={placeholder || 'Add a comment...'}
          autoFocus={autoFocus}
          value={body}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => setBody(event.target.value)}
        />

        {(isFocused || body.trim().length > 0) && (
          <div className="mt-2 flex justify-end gap-2">
            {onCancel && (
              <button
                type="button"
                className="btn-ghost px-4 py-2 text-sm"
                onClick={() => {
                  setBody('')
                  setIsFocused(false)
                  onCancel()
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={!body.trim() || createComment.isPending}
              onClick={() => void handleSubmit()}
            >
              {parentId ? 'Reply' : 'Comment'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
