begin;

create or replace function public.community_list_voice_participants(
  input_community_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    participant.user_id,
    coalesce(profile.full_name, profile.name, 'Community member')::text as display_name,
    profile.avatar_url::text,
    participant.joined_at
  from public.community_voice_participants participant
  join public.communities community
    on community.id = participant.community_id
  left join public.profiles profile
    on profile.user_id = participant.user_id
  where participant.community_id = input_community_id
    and participant.last_seen_at >= now() - interval '90 seconds'
    and participant.joined_at >= now() - interval '60 minutes'
    and community.moderation_status = 'active'
    and auth.uid() is not null
    and (
      community.visibility = 'public'
      or community.owner_id = auth.uid()
      or exists (
        select 1
        from public.community_members member
        where member.community_id = community.id
          and member.user_id = auth.uid()
          and member.membership_status = 'active'
      )
    )
  order by participant.joined_at;
$$;

revoke all on function public.community_list_voice_participants(uuid)
  from public, anon;
grant execute on function public.community_list_voice_participants(uuid)
  to authenticated;

commit;
