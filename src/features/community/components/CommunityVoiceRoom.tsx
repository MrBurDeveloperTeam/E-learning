import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Headphones, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

type VoiceMember = { userId: string; name: string; muted: boolean; joinedAt: string }
type VoiceSignal = { from: string; to: string; kind: 'ready' | 'offer' | 'answer' | 'ice'; payload?: RTCSessionDescriptionInit | RTCIceCandidateInit }

const MAX_VOICE_MEMBERS = 4
const MAX_CALL_MS = 60 * 60 * 1000
const HEARTBEAT_MS = 30 * 1000
const rtcConfiguration: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }

export function CommunityVoiceRoom({ communityId, userId, userName, canJoin, disabled = false }: { communityId: string; userId: string; userName: string; canJoin: boolean; disabled?: boolean }) {
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [muted, setMuted] = useState(false)
  const [members, setMembers] = useState<VoiceMember[]>([])
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef(new Map<string, RTCPeerConnection>())
  const joinedRef = useRef(false)
  const reservedRef = useRef(false)
  const heartbeatRef = useRef<number | null>(null)
  const callTimeoutRef = useRef<number | null>(null)

  const sendSignal = async (signal: Omit<VoiceSignal, 'from'>) => {
    await channelRef.current?.send({ type: 'broadcast', event: 'voice-signal', payload: { ...signal, from: userId } satisfies VoiceSignal })
  }

  const closePeer = (peerId: string) => {
    peersRef.current.get(peerId)?.close()
    peersRef.current.delete(peerId)
    setRemoteStreams((current) => { const next = { ...current }; delete next[peerId]; return next })
  }

  const ensurePeer = (peerId: string) => {
    const existing = peersRef.current.get(peerId)
    if (existing) return existing
    const peer = new RTCPeerConnection(rtcConfiguration)
    streamRef.current?.getTracks().forEach((track) => peer.addTrack(track, streamRef.current!))
    peer.onicecandidate = (event) => { if (event.candidate) void sendSignal({ to: peerId, kind: 'ice', payload: event.candidate.toJSON() }) }
    peer.ontrack = (event) => setRemoteStreams((current) => ({ ...current, [peerId]: event.streams[0] ?? new MediaStream([event.track]) }))
    peer.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) closePeer(peerId) }
    peersRef.current.set(peerId, peer)
    return peer
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
    channelRef.current?.untrack()
    if (channelRef.current) void supabase.removeChannel(channelRef.current)
    channelRef.current = null
    peersRef.current.forEach((peer) => peer.close())
    peersRef.current.clear()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (reservedRef.current) {
      reservedRef.current = false
      void supabase.rpc('community_leave_voice_room', { input_community_id: communityId })
    }
    setRemoteStreams({})
    setMembers([])
    setJoined(false)
    setJoining(false)
    setMuted(false)
  }

  useEffect(() => leave, [])

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
      await supabase.realtime.setAuth()
      const channel = supabase.channel(`community-voice:${communityId}`, { config: { private: true, presence: { key: userId }, broadcast: { self: false } } })
      channelRef.current = channel
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<VoiceMember>()
        const next = Object.values(state).flat().map((entry) => ({ userId: entry.userId, name: entry.name, muted: entry.muted, joinedAt: entry.joinedAt }))
        setMembers(next)
        const active = new Set(next.map((member) => member.userId))
        peersRef.current.forEach((_peer, id) => { if (!active.has(id)) closePeer(id) })
      })
      channel.on('broadcast', { event: 'voice-signal' }, async ({ payload }) => {
        const signal = payload as VoiceSignal
        if (!joinedRef.current || (signal.to !== userId && signal.to !== '*') || signal.from === userId) return
        try {
          if (signal.kind === 'ready') { if (userId.localeCompare(signal.from) < 0) await makeOffer(signal.from); return }
          const peer = ensurePeer(signal.from)
          if (signal.kind === 'offer') {
            await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
            const answer = await peer.createAnswer(); await peer.setLocalDescription(answer)
            await sendSignal({ to: signal.from, kind: 'answer', payload: answer })
          } else if (signal.kind === 'answer') await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
          else if (signal.kind === 'ice' && signal.payload) await peer.addIceCandidate(signal.payload as RTCIceCandidateInit)
        } catch { closePeer(signal.from) }
      })
      await new Promise<void>((resolve, reject) => channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          joinedRef.current = true
          await channel.track({ userId, name: userName, muted: false, joinedAt: new Date().toISOString() })
          await channel.send({ type: 'broadcast', event: 'voice-signal', payload: { from: userId, to: '*', kind: 'ready' } })
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error('Could not connect to the voice room.'))
      }))
      setJoined(true)
      heartbeatRef.current = window.setInterval(() => {
        void supabase.rpc('community_voice_heartbeat', { input_community_id: communityId }).then(({ data, error }) => {
          if (error || data !== true) {
            toast.error('Your voice session expired or lost its room reservation.')
            leave()
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
    const next = !muted
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next })
    setMuted(next)
    await channelRef.current?.track({ userId, name: userName, muted: next, joinedAt: members.find((member) => member.userId === userId)?.joinedAt ?? new Date().toISOString() })
  }

  return <div className="rounded-2xl border bg-card p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="size-4 text-primary" />Voice chat</h2>{joined && <Badge variant="secondary">Connected</Badge>}</div>
    {!joined ? <><p className="mt-2 text-sm leading-6 text-muted-foreground">Peer-to-peer room · up to {MAX_VOICE_MEMBERS} members · 60-minute limit · no recording or sharing.</p><Button className="mt-4 w-full" disabled={!canJoin || disabled || joining} onClick={() => void join()}><Headphones />{joining ? 'Connecting…' : !canJoin ? 'Join the Community first' : 'Join voice chat'}</Button></> : <>
      <div className="mt-4 space-y-2">{members.map((member) => <div key={member.userId} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm"><span className="truncate">{member.name}{member.userId === userId ? ' (You)' : ''}</span>{member.muted ? <MicOff className="size-4 text-muted-foreground" /> : <Mic className="size-4 text-emerald-600" />}</div>)}</div>
      {Object.entries(remoteStreams).map(([peerId, stream]) => <audio key={peerId} autoPlay playsInline ref={(element) => { if (element && element.srcObject !== stream) element.srcObject = stream }} />)}
      <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => void toggleMute()}>{muted ? <MicOff /> : <Mic />}{muted ? 'Unmute' : 'Mute'}</Button><Button variant="destructive" onClick={leave}><PhoneOff />Leave</Button></div>
    </>}
  </div>
}
