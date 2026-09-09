import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Headphones, Mic, MicOff, PhoneOff, UserMinus, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { supabase } from '@/lib/supabase'

type VoiceMember = { userId: string; name: string; muted: boolean; joinedAt: string; avatarUrl?: string | null }
type VoiceParticipantRow = { user_id: string; display_name: string; avatar_url: string | null; joined_at: string; is_owner_muted: boolean }
type VoiceSignalKind = 'ready' | 'offer' | 'answer' | 'ice' | 'mute' | 'leave' | 'owner_mute' | 'owner_unmute' | 'owner_remove'
type VoiceSignal = { to: string | null; kind: VoiceSignalKind; payload?: RTCSessionDescriptionInit | RTCIceCandidateInit }
type VoiceSignalRow = {
  sender_id: string
  recipient_id: string | null
  signal_kind: VoiceSignalKind
  payload: { data?: RTCSessionDescriptionInit | RTCIceCandidateInit; member?: VoiceMember; target_user_id?: string }
}

const MAX_VOICE_MEMBERS = 4
const MAX_CALL_MS = 60 * 60 * 1000
const HEARTBEAT_MS = 30 * 1000
const LOBBY_REFRESH_MS = 15 * 1000
const rtcConfiguration: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }

export function CommunityVoiceRoom({ communityId, userId, userName, visibility, canJoin, isOwner = false, disabled = false }: { communityId: string; userId: string; userName: string; visibility: 'public' | 'private'; canJoin: boolean; isOwner?: boolean; disabled?: boolean }) {
  const voiceTopic = `community-voice-${visibility}:${communityId}`
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [muted, setMuted] = useState(false)
  const [ownerMuted, setOwnerMuted] = useState(false)
  const [moderatingUserId, setModeratingUserId] = useState<string | null>(null)
  const [members, setMembers] = useState<VoiceMember[]>([])
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef(new Map<string, RTCPeerConnection>())
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>())
  const joinedRef = useRef(false)
  const reservedRef = useRef(false)
  const heartbeatRef = useRef<number | null>(null)
  const callTimeoutRef = useRef<number | null>(null)

  const loadVisibleMembers = async () => {
    const { data, error } = await supabase.rpc('community_list_voice_participants_v2', { input_community_id: communityId })
    if (error) throw error
    if (!joinedRef.current) {
      setMembers(((data ?? []) as VoiceParticipantRow[]).map((participant) => ({
        userId: participant.user_id,
        name: participant.display_name,
        avatarUrl: participant.avatar_url,
        muted: participant.is_owner_muted,
        joinedAt: participant.joined_at,
      })))
    }
  }

  const sendSignal = async (signal: VoiceSignal, memberMuted = muted) => {
    const { error } = await supabase.rpc('community_send_voice_signal', {
      input_community_id: communityId,
      input_recipient_id: signal.to,
      input_signal_kind: signal.kind,
      input_payload: {
        data: signal.payload ?? null,
        member: { userId, name: userName, muted: memberMuted, joinedAt: new Date().toISOString() },
      },
    })
    if (error) throw error
  }

  const upsertMember = (member: VoiceMember) => setMembers((current) => {
    const withoutMember = current.filter((entry) => entry.userId !== member.userId)
    return [...withoutMember, member]
  })

  const closePeer = (peerId: string) => {
    peersRef.current.get(peerId)?.close()
    peersRef.current.delete(peerId)
    pendingCandidatesRef.current.delete(peerId)
    setRemoteStreams((current) => { const next = { ...current }; delete next[peerId]; return next })
  }

  const ensurePeer = (peerId: string) => {
    const existing = peersRef.current.get(peerId)
    if (existing) return existing
    const peer = new RTCPeerConnection(rtcConfiguration)
    streamRef.current?.getTracks().forEach((track) => peer.addTrack(track, streamRef.current!))
    peer.onicecandidate = (event) => {
      if (event.candidate) void sendSignal({ to: peerId, kind: 'ice', payload: event.candidate.toJSON() }).catch(() => closePeer(peerId))
    }
    peer.ontrack = (event) => setRemoteStreams((current) => ({ ...current, [peerId]: event.streams[0] ?? new MediaStream([event.track]) }))
    peer.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) closePeer(peerId) }
    peersRef.current.set(peerId, peer)
    return peer
  }

  const flushPendingCandidates = async (peerId: string, peer: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current.get(peerId) ?? []
    pendingCandidatesRef.current.delete(peerId)
    for (const candidate of candidates) await peer.addIceCandidate(candidate)
  }

  const makeOffer = async (peerId: string) => {
    const peer = ensurePeer(peerId)
    if (peer.signalingState !== 'stable') return
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    await sendSignal({ to: peerId, kind: 'offer', payload: offer })
  }

  const leave = () => {
    joinedRef.current = false
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
    if (callTimeoutRef.current) window.clearTimeout(callTimeoutRef.current)
    heartbeatRef.current = null
    callTimeoutRef.current = null
    if (channelRef.current) void supabase.removeChannel(channelRef.current)
    channelRef.current = null
    peersRef.current.forEach((peer) => peer.close())
    peersRef.current.clear()
    pendingCandidatesRef.current.clear()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (reservedRef.current) {
      reservedRef.current = false
      void sendSignal({ to: null, kind: 'leave' })
        .catch(() => undefined)
        .then(() => supabase.rpc('community_leave_voice_room', { input_community_id: communityId }))
    }
    setRemoteStreams({})
    setMembers([])
    setJoined(false)
    setJoining(false)
    setMuted(false)
    setOwnerMuted(false)
  }

  const moderateMember = async (member: VoiceMember, action: 'mute' | 'unmute' | 'remove') => {
    if (!isOwner || member.userId === userId || moderatingUserId) return
    setModeratingUserId(member.userId)
    try {
      const { error } = await supabase.rpc('community_owner_moderate_voice_participant', {
        input_community_id: communityId,
        input_user_id: member.userId,
        input_action: action,
      })
      if (error) throw error
      if (action === 'remove') {
        closePeer(member.userId)
        setMembers((current) => current.filter((entry) => entry.userId !== member.userId))
        toast.success(`${member.name} was removed from the voice room.`)
      } else {
        peersRef.current.get(member.userId)?.getReceivers().forEach((receiver) => { if (receiver.track.kind === 'audio') receiver.track.enabled = action !== 'mute' })
        setMembers((current) => current.map((entry) => entry.userId === member.userId ? { ...entry, muted: action === 'mute' } : entry))
        toast.success(action === 'mute' ? `${member.name} was muted by the owner.` : `${member.name} may unmute now.`)
      }
      if (!joinedRef.current) await loadVisibleMembers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not manage this voice participant.')
    } finally {
      setModeratingUserId(null)
    }
  }

  useEffect(() => {
    void loadVisibleMembers().catch(() => undefined)
    const refresh = window.setInterval(() => {
      if (!joinedRef.current) void loadVisibleMembers().catch(() => undefined)
    }, LOBBY_REFRESH_MS)
    return () => {
      window.clearInterval(refresh)
      leave()
    }
  }, [communityId])

  const join = async () => {
    if (!canJoin || disabled || joining || joined) return
    if (members.length >= MAX_VOICE_MEMBERS) {
      toast.error(`This voice room is limited to ${MAX_VOICE_MEMBERS} members.`)
      return
    }
    setJoining(true)
    try {
      const reservation = await supabase.rpc('community_join_voice_room', { input_community_id: communityId })
      if (reservation.error) throw reservation.error
      reservedRef.current = true
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice chat is not supported by this browser.')
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      const channel = supabase.channel(voiceTopic)
      channelRef.current = channel
      channel.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'community_voice_signals',
        filter: `community_id=eq.${communityId}`,
      }, async (change) => {
        const signal = change.new as VoiceSignalRow
        if (!joinedRef.current || signal.sender_id === userId) return
        if (signal.recipient_id && signal.recipient_id !== userId) return
        const member = signal.payload.member
        if (signal.signal_kind === 'leave') {
          closePeer(signal.sender_id)
          setMembers((current) => current.filter((entry) => entry.userId !== signal.sender_id))
          return
        }
        if (signal.signal_kind === 'owner_mute') {
          const targetUserId = signal.payload.target_user_id
          if (targetUserId) {
            peersRef.current.get(targetUserId)?.getReceivers().forEach((receiver) => { if (receiver.track.kind === 'audio') receiver.track.enabled = false })
            setMembers((current) => current.map((entry) => entry.userId === targetUserId ? { ...entry, muted: true } : entry))
          }
          if (targetUserId === userId) {
            streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false })
            setMuted(true)
            setOwnerMuted(true)
            toast.warning('The Community owner muted your microphone.')
          }
          return
        }
        if (signal.signal_kind === 'owner_unmute') {
          const targetUserId = signal.payload.target_user_id
          if (targetUserId) {
            peersRef.current.get(targetUserId)?.getReceivers().forEach((receiver) => { if (receiver.track.kind === 'audio') receiver.track.enabled = true })
            setMembers((current) => current.map((entry) => entry.userId === targetUserId ? { ...entry, muted: false } : entry))
          }
          if (targetUserId === userId) {
            setOwnerMuted(false)
            toast.info('The Community owner removed your mute restriction. You may unmute when ready.')
          }
          return
        }
        if (signal.signal_kind === 'owner_remove') {
          leave()
          toast.error('The Community owner removed you from this voice room.')
          return
        }
        if (member) upsertMember(member)
        try {
          if (signal.signal_kind === 'ready') {
            if (!signal.recipient_id) await sendSignal({ to: signal.sender_id, kind: 'ready' })
            if (userId.localeCompare(signal.sender_id) < 0) await makeOffer(signal.sender_id)
            return
          }
          if (signal.signal_kind === 'mute') return
          const peer = ensurePeer(signal.sender_id)
          if (signal.signal_kind === 'offer') {
            await peer.setRemoteDescription(signal.payload.data as RTCSessionDescriptionInit)
            await flushPendingCandidates(signal.sender_id, peer)
            const answer = await peer.createAnswer(); await peer.setLocalDescription(answer)
            await sendSignal({ to: signal.sender_id, kind: 'answer', payload: answer })
          } else if (signal.signal_kind === 'answer') {
            await peer.setRemoteDescription(signal.payload.data as RTCSessionDescriptionInit)
            await flushPendingCandidates(signal.sender_id, peer)
          } else if (signal.signal_kind === 'ice' && signal.payload.data) {
            const candidate = signal.payload.data as RTCIceCandidateInit
            if (peer.remoteDescription) await peer.addIceCandidate(candidate)
            else pendingCandidatesRef.current.set(signal.sender_id, [...(pendingCandidatesRef.current.get(signal.sender_id) ?? []), candidate])
          }
        } catch { closePeer(signal.sender_id) }
      })
      await new Promise<void>((resolve, reject) => channel.subscribe((status, connectionError) => {
        if (status === 'SUBSCRIBED') {
          void (async () => {
            try {
              joinedRef.current = true
              upsertMember({ userId, name: userName, muted: false, joinedAt: new Date().toISOString() })
              await sendSignal({ to: null, kind: 'ready' })
              resolve()
            } catch (error) { reject(error) }
          })()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(connectionError?.message || `Could not connect to the secure voice room (${status.toLowerCase().replace('_', ' ')}).`))
      }))
      setJoined(true)
      heartbeatRef.current = window.setInterval(() => {
        void supabase.rpc('community_voice_heartbeat_status', { input_community_id: communityId }).then(({ data, error }) => {
          const status = data as { active?: boolean; owner_muted?: boolean } | null
          if (error || status?.active !== true) {
            toast.error('Your voice session expired or lost its room reservation.')
            leave()
          } else if (status.owner_muted && !ownerMuted) {
            streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false })
            setMuted(true)
            setOwnerMuted(true)
          }
        })
      }, HEARTBEAT_MS)
      const joinedAt = Date.parse(String(reservation.data))
      callTimeoutRef.current = window.setTimeout(() => {
        toast.info('The 60-minute voice session limit has been reached.')
        leave()
      }, Math.max(0, MAX_CALL_MS - (Date.now() - joinedAt)))
    } catch (error) {
      leave()
      toast.error(error instanceof Error ? error.message : 'Could not join voice chat. Check microphone permission.')
    } finally { setJoining(false) }
  }

  const toggleMute = async () => {
    if (ownerMuted) {
      toast.error('The Community owner has muted your microphone.')
      return
    }
    const next = !muted
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next })
    setMuted(next)
    await sendSignal({ to: null, kind: 'mute' }, next)
  }

  return <div className="rounded-2xl border bg-card p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="size-4 text-primary" />Voice chat</h2>{joined && <Badge variant="secondary">Connected</Badge>}</div>
    {!joined ? <><p className="mt-2 text-sm leading-6 text-muted-foreground">Peer-to-peer room · up to {MAX_VOICE_MEMBERS} members · 60-minute limit · no recording or sharing.</p>{members.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-medium text-muted-foreground">In voice now · {members.length}</p>{members.map((member) => <VoiceMemberItem key={member.userId} member={member} currentUserId={userId} isOwner={isOwner} busy={moderatingUserId === member.userId} onModerate={moderateMember} />)}</div>}<Button className="mt-4 w-full" disabled={!canJoin || disabled || joining} onClick={() => void join()}><Headphones />{joining ? 'Connecting…' : !canJoin ? 'Join the Community first' : 'Join voice chat'}</Button></> : <>
      <div className="mt-4 space-y-2">{members.map((member) => <VoiceMemberItem key={member.userId} member={member} currentUserId={userId} isOwner={isOwner} busy={moderatingUserId === member.userId} onModerate={moderateMember} />)}</div>
      {Object.entries(remoteStreams).map(([peerId, stream]) => <audio key={peerId} autoPlay playsInline ref={(element) => { if (element && element.srcObject !== stream) element.srcObject = stream }} />)}
      <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" disabled={ownerMuted} onClick={() => void toggleMute()}>{muted ? <MicOff /> : <Mic />}{ownerMuted ? 'Muted by owner' : muted ? 'Unmute' : 'Mute'}</Button><Button variant="destructive" onClick={leave}><PhoneOff />Leave</Button></div>
    </>}
  </div>
}

function VoiceMemberItem({ member, currentUserId, isOwner, busy, onModerate }: { member: VoiceMember; currentUserId: string; isOwner: boolean; busy: boolean; onModerate: (member: VoiceMember, action: 'mute' | 'unmute' | 'remove') => Promise<void> }) {
  const canModerate = isOwner && member.userId !== currentUserId
  return <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
    <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size={28} />
    <span className="min-w-0 flex-1 truncate">{member.name}{member.userId === currentUserId ? ' (You)' : ''}</span>
    {member.muted ? <MicOff className="size-4 text-muted-foreground" /> : <Mic className="size-4 text-emerald-600" />}
    {canModerate && <div className="flex gap-1">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void onModerate(member, member.muted ? 'unmute' : 'mute')}>{member.muted ? <Mic /> : <MicOff />}{member.muted ? 'Allow' : 'Mute'}</Button>
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => void onModerate(member, 'remove')}><UserMinus />Remove</Button>
    </div>}
  </div>
}
