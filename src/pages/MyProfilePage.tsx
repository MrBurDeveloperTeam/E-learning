import { Navbar } from '@/components/layout/Navbar'
import { CommunityMe } from '@/features/community/components/CommunityMe'
import { useAuthStore } from '@/store/authStore'
import '@/features/community/styles/community-dashboard.css'
import '@/features/community/styles/community-controls.css'

export function MyProfilePage() {
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)

  return (
    <div data-community-tab="me" className="community-dashboard min-h-screen bg-background">
      <Navbar />
      <main className="community-dashboard-main mx-auto w-full max-w-[1100px] px-4 pb-20 pt-6 sm:px-6 md:pt-10">
        <h1 className="sr-only">My Profile</h1>
        {user && <CommunityMe userId={user.id} profile={profile} openFollowRequests={new URLSearchParams(window.location.search).get('requests') === '1'} />}
      </main>
    </div>
  )
}
