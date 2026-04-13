import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Logo } from '../components/brand/Logo'

export function Landing() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  const redirectTo = search?.redirect ?? '/explore'

  useEffect(() => {
    if (user) {
      void navigate({ to: redirectTo, replace: true })
    }
  }, [user, navigate, redirectTo])

  if (user) return null

  return (
    <div className="min-h-screen bg-white selection:bg-[#88C1BD]/30">
      {/* Navigation - simplified for landing */}
      <nav className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-[#D4E8E7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-[#6B8E8E] hover:text-[#2D6E6A] transition-colors">
              Log in
            </Link>
            <Link to="/register">
              <button className="bg-[#1E3333] text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-[#2D6E6A] transition-all shadow-lg shadow-teal-900/10 active:scale-95">
                Join Now
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 bg-[radial-gradient(circle_at_50%_0%,#EAF4F3_0%,rgba(255,255,255,0)_70%)]" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF4F3] border border-[#88C1BD]/30 text-[#2D6E6A] text-xs font-semibold mb-6 animate-fade-in">
              <span className="flex h-2 w-2 rounded-full bg-[#88C1BD] animate-pulse" />
              THE FUTURE OF DENTAL EDUCATION
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold text-[#1E3333] tracking-tight mb-6 leading-[1.1]">
              Master Dentistry <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2D6E6A] to-[#88C1BD]">
                With The World's Best
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-lg lg:text-xl text-[#6B8E8E] mb-10 leading-relaxed">
              Experience clinical excellence through high-definition surgical videos, 
              interactive courses, and insights from global thought leaders in dentistry.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <button className="w-full sm:w-auto bg-[#88C1BD] text-[#1A4A47] px-8 py-4 rounded-full text-base font-semibold hover:bg-[#5A8784] hover:text-white transition-all shadow-xl shadow-[#88C1BD]/20 active:scale-95">
                  Get Started Free
                </button>
              </Link>
              <Link to="/explore">
                <button className="w-full sm:w-auto bg-white border border-[#D4E8E7] text-[#1E3333] px-8 py-4 rounded-full text-base font-semibold hover:bg-[#F7FAFA] transition-all active:scale-95">
                  Browse Videos
                </button>
              </Link>
            </div>

            {/* Visual Mockup - Placeholder using basic CSS styling to look like a video player */}
            <div className="mt-20 relative max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border-4 border-white animate-fade-in group">
              <div className="aspect-video bg-[#1E3333] flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                
                {/* Simulated interface */}
                <div className="absolute inset-0 p-8 flex flex-col justify-end text-left">
                  <div className="h-1.5 w-full bg-white/20 rounded-full mb-4">
                    <div className="h-full w-1/3 bg-[#88C1BD] rounded-full" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-48 bg-white/30 rounded-full" />
                        <div className="h-2 w-32 bg-white/20 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 text-white/50 group-hover:text-white/80 transition-colors">
                  <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-[#F7FAFA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-[#1E3333] mb-4">
                Designed for the Modern Clinician
              </h2>
              <p className="text-[#6B8E8E] max-w-xl mx-auto">
                Comprehensive educational tools built to fit your busy surgical schedule and learning style.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <div key={i} className="bg-white p-8 rounded-3xl border border-[#D4E8E7] hover:border-[#88C1BD] transition-all hover:shadow-xl hover:shadow-teal-900/5 group">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors", feature.color)}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#1E3333] mb-3 group-hover:text-[#2D6E6A] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-[#6B8E8E] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Categories Preview */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 space-y-8">
              <h2 className="text-3xl lg:text-5xl font-bold text-[#1E3333] leading-tight">
                Specialize in What <br />
                Matters to You
              </h2>
              <p className="text-[#6B8E8E] text-lg">
                From basic restorative techniques to advanced microsurgery, 
                our library covers the full spectrum of modern dentistry.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {['Implantology', 'Orthodontics', 'Endodontics', 'Periodontics', 'Oral Surgery', 'Aesthetics'].map((cat) => (
                  <div key={cat} className="flex items-center gap-3 text-[#1E3333] font-medium">
                    <div className="w-5 h-5 rounded-full bg-[#EAF4F3] flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#2D6E6A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {cat}
                  </div>
                ))}
              </div>
              <Link to="/register">
                <button className="text-[#2D6E6A] font-bold flex items-center gap-2 group">
                  Explore all categories
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </Link>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-6 w-full">
               <div className="space-y-6">
                  <div className="h-48 rounded-3xl bg-gradient-to-br from-[#88C1BD] to-[#2D6E6A] shadow-lg" />
                  <div className="h-64 rounded-3xl bg-[#EAF4F3] flex items-end p-6 border border-[#D4E8E7]">
                    <div className="space-y-2">
                       <div className="h-2.5 w-20 bg-[#88C1BD] rounded-full" />
                       <div className="h-2 w-32 bg-[#2D6E6A]/20 rounded-full" />
                    </div>
                  </div>
               </div>
               <div className="space-y-6 pt-12">
                  <div className="h-64 rounded-3xl bg-[#1E3333] flex items-center justify-center">
                     <svg className="w-12 h-12 text-[#88C1BD]/30" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                  </div>
                  <div className="h-48 rounded-3xl bg-[#88C1BD] shadow-lg" />
               </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="bg-[#1E3333] rounded-[3rem] p-12 lg:p-20 relative overflow-hidden text-center">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#88C1BD]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                Ready to elevate <br /> your practice?
              </h2>
              <p className="text-[#88C1BD] text-lg mb-10 max-w-lg mx-auto">
                Join our community of over 5,000 clinicians and world-class dental educators.
              </p>
              <Link to="/register">
                <button className="bg-[#88C1BD] text-[#1A4A47] px-10 py-5 rounded-full text-lg font-bold hover:bg-white transition-all shadow-2xl active:scale-95">
                  Join DentalLearn Today
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-[#D4E8E7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <Logo />
            <p className="text-[#6B8E8E] text-sm">© 2026 DentalLearn Education Inc.</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-sm text-[#6B8E8E] hover:text-[#2D6E6A]">Professional Terms</a>
            <a href="#" className="text-sm text-[#6B8E8E] hover:text-[#2D6E6A]">Privacy Policy</a>
            <a href="#" className="text-sm text-[#6B8E8E] hover:text-[#2D6E6A]">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

const features = [
  {
    title: 'Expert Instruction',
    description: 'Learn step-by-step from world-renowned surgeons and specialized practitioners.',
    color: 'bg-[#EAF4F3] text-[#2D6E6A]',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    title: '4K Clinical Video',
    description: 'Crystal clear surgical perspectives that feel like you are standing right next to the chair.',
    color: 'bg-[#F0EAFB] text-[#7C3AED]',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    title: 'CE Certification',
    description: 'Earn continuing education credits recognized globally on completion of specialized pathways.',
    color: 'bg-[#FEF7E5] text-[#D97706]',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  }
]
