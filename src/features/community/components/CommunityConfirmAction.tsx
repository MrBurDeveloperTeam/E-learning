import { useState, type ReactNode } from 'react'
import type React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function CommunityConfirmAction({trigger,title,description,label,onConfirm,danger=true}:{trigger:ReactNode;title:string;description:string;label:string;onConfirm:()=>Promise<unknown>;danger?:boolean}){
  const[open,setOpen]=useState(false),[pending,setPending]=useState(false)
  async function confirm(){setPending(true);try{await onConfirm();setOpen(false)}finally{setPending(false)}}
  return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value)}}><DialogTrigger render={trigger as React.ReactElement}/><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline" disabled={pending}/>}>Cancel</DialogClose><Button variant={danger?'destructive':'default'} disabled={pending} onClick={()=>void confirm()}>{pending?'Working…':label}</Button></DialogFooter></DialogContent></Dialog>
}
