import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CommunityConfirmAction } from '@/features/community/components/CommunityConfirmAction'
import { useCommunityOwnerActions } from '@/features/community/hooks/useCommunity'

type Rule = { id: string; title: string; description: string | null; position: number }

export function CommunityRuleManager({ communityId, rules }: { communityId: string; rules: Rule[] }) {
  const actions = useCommunityOwnerActions(communityId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const sorted = useMemo(() => [...rules].sort((a, b) => a.position - b.position), [rules])

  const duplicate = (value: string, ignoredId?: string | null) =>
    rules.some(rule => rule.id !== ignoredId && rule.title.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase())

  const reset = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setError('')
  }

  const save = async () => {
    if (duplicate(title, editingId)) {
      setError('A rule with this title already exists.')
      return
    }
    if (editingId) {
      await actions.mutateAsync({ action: 'update_rule', ruleId: editingId, title, description })
      toast.success('Rule updated.')
    } else {
      await actions.mutateAsync({ action: 'add_rule', title, description, position: rules.length })
      toast.success('Rule added.')
    }
    reset()
  }

  return <section>
    <h3 className="text-sm font-semibold">Community rules ({rules.length}/20)</h3>
    <div className="mt-3 space-y-2">
      {sorted.map((rule, index) => <div key={rule.id} className="flex items-start gap-2 rounded-xl border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{index + 1}. {rule.title}</p>
          {rule.description && <p className="mt-1 text-xs text-muted-foreground">{rule.description}</p>}
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Move rule up" disabled={index === 0 || actions.isPending} onClick={() => void actions.mutateAsync({ action: 'move_rule', ruleId: rule.id, direction: 'up' })}><ArrowUp /></Button>
        <Button size="icon-sm" variant="ghost" aria-label="Move rule down" disabled={index === sorted.length - 1 || actions.isPending} onClick={() => void actions.mutateAsync({ action: 'move_rule', ruleId: rule.id, direction: 'down' })}><ArrowDown /></Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${rule.title}`} onClick={() => { setEditingId(rule.id); setTitle(rule.title); setDescription(rule.description ?? ''); setError('') }}><Pencil /></Button>
        <CommunityConfirmAction trigger={<Button size="icon-sm" variant="ghost" aria-label={`Delete ${rule.title}`}><Trash2 /></Button>} title={`Delete “${rule.title}”?`} description="Members will no longer see this rule. This action cannot be undone." label="Delete rule" onConfirm={() => actions.mutateAsync({ action: 'delete_rule', ruleId: rule.id })} />
      </div>)}
    </div>
    <div className="mt-3 grid gap-2">
      <Input value={title} maxLength={120} placeholder="Rule title" onChange={event => { setTitle(event.target.value); setError('') }} />
      <Textarea value={description} maxLength={1000} className="resize-none" placeholder="Short explanation (optional)" onChange={event => setDescription(event.target.value)} />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={title.trim().length < 2 || actions.isPending || (!editingId && rules.length >= 20)} onClick={() => void save()}>{editingId ? <Pencil /> : <Plus />}{editingId ? 'Save rule' : 'Add rule'}</Button>
        {editingId && <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>}
      </div>
      {!editingId && rules.length >= 20 && <p className="text-xs text-muted-foreground">This Community has reached the 20-rule limit.</p>}
    </div>
  </section>
}
