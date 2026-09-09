import type { ComponentProps } from 'react'
import { DialogContent as Content } from '@/components/ui/dialog'
import { SelectContent as Options } from '@/components/ui/select'
import '../styles/community-space.css'
export { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
export function DialogContent({ className = '', overlayClassName = '', ...props }: ComponentProps<typeof Content>) {
  return <Content {...props} className={`community-space-dialog ${className}`} overlayClassName={`community-space-overlay ${overlayClassName}`} />
}
export { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
export function SelectContent({ className = '', positionerClassName = '', ...props }: ComponentProps<typeof Options>) {
  return <Options {...props} className={`community-space-options ${className}`} positionerClassName={`community-space-options-layer ${positionerClassName}`} />
}
