import { useState } from 'react'
import { Plus, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { RetryCard } from '@/components/shared/RetryCard'
import { useAddCommunityBlockedWord, useCommunityBlockedWords, useDeleteCommunityBlockedWord, useToggleCommunityBlockedWord, useUpdateCommunityBlockedWord } from '@/features/community/hooks/useCommunityBlockedWords'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function CommunityBlockedWordsAdmin({ adminId }: { adminId: string }) {
  const query = useCommunityBlockedWords()
  const addMutation = useAddCommunityBlockedWord(adminId)
  const toggleMutation = useToggleCommunityBlockedWord()
  const deleteMutation = useDeleteCommunityBlockedWord()
  const updateMutation = useUpdateCommunityBlockedWord()
  const [term, setTerm] = useState('')
  const [severity, setSeverity] = useState<'warn' | 'review' | 'block'>('block')
  const [matchMode, setMatchMode] = useState<'word' | 'phrase'>('phrase')

  const terms = term.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean)

  const add = async () => {
    if (terms.length === 0) return
    if (terms.some((value) => value.length > 100)) { toast.error('Each word or phrase must be 100 characters or fewer.'); return }
    try {
      for (const value of [...new Set(terms)]) await addMutation.mutateAsync({ term: value, severity, matchMode })
      setTerm('')
      toast.success(`${new Set(terms).size} safety rule${new Set(terms).size === 1 ? '' : 's'} added.`)
    }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Blocked word could not be added.') }
  }

  return <div>
    <form noValidate className="grid gap-2 border-b border-border p-5 sm:grid-cols-[minmax(0,1fr)_140px_140px_auto]" onSubmit={(event) => { event.preventDefault(); void add() }}>
      <Input value={term} onChange={(event) => setTerm(event.target.value)} maxLength={1000} placeholder="Add words or phrases, separated by commas" aria-label="Blocked words or phrases" />
      <Select value={severity} onValueChange={(value) => setSeverity(value as typeof severity)}><SelectTrigger aria-label="Rule severity" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warn">Warn</SelectItem><SelectItem value="review">Review</SelectItem><SelectItem value="block">Block</SelectItem></SelectContent></Select>
      <Select value={matchMode} onValueChange={(value) => setMatchMode(value as typeof matchMode)}><SelectTrigger aria-label="Match mode" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="word">Whole word</SelectItem><SelectItem value="phrase">Phrase + bypass</SelectItem></SelectContent></Select>
      <Button type="submit" disabled={terms.length === 0 || addMutation.isPending}><Plus className="size-4" />Add{terms.length > 1 ? ` ${new Set(terms).size}` : ''}</Button>
    </form>
    {query.isLoading && <div className="flex min-h-64 items-center justify-center"><LoadingSpinner /></div>}
    {query.isError && <div className="p-6"><RetryCard onRetry={() => void query.refetch()} /></div>}
    {!query.isLoading && !query.isError && query.data?.length === 0 && <div className="p-6"><EmptyState icon={<ShieldOff />} title="No blocked words" description="Comments currently publish without automatic word filtering." /></div>}
    {!query.isLoading && !query.isError && <div className="divide-y divide-border">{query.data?.map((word) => <div key={word.id} className="flex items-center gap-3 p-5">
      <div className="min-w-0 flex-1"><p className="truncate font-medium">{word.term}</p><p className="text-xs text-muted-foreground">{word.is_active ? `Active · ${word.match_mode === 'word' ? 'whole word' : 'phrase/bypass matching'}` : 'Inactive'}</p></div>
      <Select value={word.severity} onValueChange={(value) => void updateMutation.mutateAsync({ id: word.id, values: { severity: value as typeof word.severity } })}><SelectTrigger size="sm" aria-label={`Severity for ${word.term}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warn">Warn</SelectItem><SelectItem value="review">Review</SelectItem><SelectItem value="block">Block</SelectItem></SelectContent></Select>
      <Button variant="outline" size="sm" disabled={toggleMutation.isPending} onClick={() => void toggleMutation.mutateAsync({ id: word.id, isActive: !word.is_active })}>{word.is_active ? 'Disable' : 'Enable'}</Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${word.term}`} disabled={deleteMutation.isPending} onClick={() => void deleteMutation.mutateAsync(word.id)}><Trash2 className="size-4" /></Button>
    </div>)}</div>}
  </div>
}
