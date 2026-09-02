import { useRef, useState } from 'react'
import { FileCheck2, GraduationCap, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useMyVerification, useSubmitVerification } from '@/features/community/hooks/useCommunityVerification'

export function ProfessionalVerification({ userId }: { userId: string }) {
  const query = useMyVerification(userId); const mutation = useSubmitVerification(userId)
  const inputRef = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); const [error, setError] = useState('')
  const latest = query.data?.[0]
  function choose(next: File | null) { setError(''); if (!next) return setFile(null); if (!['application/pdf', 'image/jpeg', 'image/png'].includes(next.type)) return setError('Use a PDF, JPG, or PNG file.'); if (next.size > 10 * 1024 * 1024) return setError('File must be 10 MB or smaller.'); if (!next.size) return setError('The selected file is empty.'); setFile(next) }
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); if (!file) return setError('Add one credential document.'); try { await mutation.mutateAsync({ userId, professionalTitle: String(form.get('professionalTitle')), licenseNumber: String(form.get('licenseNumber')), issuingBody: String(form.get('issuingBody')), country: String(form.get('country')), evidenceNotes: String(form.get('evidenceNotes')), file }); toast.success('Verification application submitted.'); setFile(null); event.currentTarget.reset() } catch (e) { toast.error(e instanceof Error ? e.message : 'Application could not be submitted.') } }
  if (query.isLoading) return <div className="flex min-h-48 items-center justify-center"><LoadingSpinner /></div>
  if (latest?.status === 'pending_review') return <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"><Badge variant="outline">Pending review</Badge><h3 className="mt-3 font-semibold">Your credentials are being reviewed</h3><p className="mt-2 text-sm text-muted-foreground">Submitted as {latest.professional_title} through {latest.issuing_body}. You can apply again after an admin decision.</p></div>
  if (latest?.status === 'approved') return <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-6"><GraduationCap className="size-8 text-primary" /><h3 className="mt-3 font-semibold">Professional verification approved</h3><p className="mt-2 text-sm text-muted-foreground">The verified graduation-cap badge is now associated with your profile.</p></div>
  return <form noValidate onSubmit={submit} className="mt-5 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div><h3 className="font-semibold">Apply for professional verification</h3><p className="mt-1 text-sm text-muted-foreground">Your credential file remains private and is visible only to you and platform administrators.</p>{latest?.status === 'rejected' && <p className="mt-2 text-sm text-destructive">Previous decision: {latest.review_note}</p>}</div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="professionalTitle">Professional title</Label><Input id="professionalTitle" name="professionalTitle" required minLength={2} /></div><div className="space-y-2"><Label htmlFor="licenseNumber">License or registration number</Label><Input id="licenseNumber" name="licenseNumber" required minLength={2} /></div><div className="space-y-2"><Label htmlFor="issuingBody">Issuing body</Label><Input id="issuingBody" name="issuingBody" required minLength={2} /></div><div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" name="country" required minLength={2} /></div></div>
    <div className="space-y-2"><Label htmlFor="evidenceNotes">Supporting notes</Label><Textarea id="evidenceNotes" name="evidenceNotes" maxLength={1000} className="min-h-24 resize-none" /></div>
    <div className="space-y-2"><Label>Credential evidence</Label><input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => choose(e.target.files?.[0] ?? null)} /><button type="button" onClick={() => inputRef.current?.click()} className="flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Upload className="size-6 text-primary" /><span className="mt-2 text-sm font-medium">Choose credential file</span><span className="text-xs text-muted-foreground">PDF, JPG, or PNG · maximum 10 MB</span></button>{file && <div className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm"><FileCheck2 className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">{file.name}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove selected file" onClick={() => choose(null)}><X /></Button></div>}{error && <p className="text-sm text-destructive" role="alert">{error}</p>}</div>
    <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Submitting…' : 'Submit for review'}</Button>
  </form>
}
