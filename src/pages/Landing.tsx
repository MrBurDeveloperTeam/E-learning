import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Menu,
  Play,
  Search,
  Stethoscope,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getSnabbbSignupUrl } from '@/lib/authLinks'
import { Logo } from '../components/brand/Logo'
// import { ThemeToggle } from '../components/layout/ThemeToggle'
import './Landing.css'

const features = [
  {
    icon: Video,
    title: 'Clinical video library',
    description:
      'Watch high-definition procedures and clinical demonstrations from dental professionals around the world.',
  },
  {
    icon: Stethoscope,
    title: 'Expert instruction',
    description:
      'Learn practical techniques, treatment planning, and clinical decision-making from experienced practitioners.',
  },
  {
    icon: Award,
    title: 'CPD-ready learning',
    description:
      'Follow structured educational pathways and build knowledge that supports your continuing professional development.',
  },
  {
    icon: Users,
    title: 'Professional community',
    description:
      'Connect with dentists, specialists, educators, and colleagues who share your commitment to better care.',
  },
  {
    icon: Search,
    title: 'Find what matters',
    description:
      'Explore specialties, categories, creators, and topics through a focused learning experience.',
  },
  {
    icon: Clock3,
    title: 'Learn at your pace',
    description:
      'Save useful content and return to important lessons whenever your schedule allows.',
  },
]

const faqs = [
  {
    question: 'Who is DentalLearn for?',
    answer:
      'DentalLearn is built for dentists, specialists, students, educators, and dental professionals who want to learn from reliable clinical content.',
  },
  {
    question: 'What kind of content can I find?',
    answer:
      'You can explore clinical procedures, specialty-focused videos, treatment demonstrations, professional insights, and educational resources.',
  },
  {
    question: 'Can I save videos for later?',
    answer:
      'Yes. Once signed in, you can save useful videos and return to them from your personal library.',
  },
  {
    question: 'Is DentalLearn available on mobile?',
    answer:
      'Yes. The landing page and learning experience are responsive and designed to work across desktop, tablet, and mobile screens.',
  },
]

function LearningPreview() {
  return (
    <div className="dl-preview-wrap">
      <div className="dl-preview-glow dl-preview-glow-one" />
      <div className="dl-preview-glow dl-preview-glow-two" />

      <div className="dl-preview-shell">
        <div className="dl-browser-bar">
          <div className="dl-browser-dots" aria-hidden="true">
            <span className="dl-dot dl-dot-red" />
            <span className="dl-dot dl-dot-yellow" />
            <span className="dl-dot dl-dot-green" />
          </div>

          <div className="dl-browser-address">
            dentallearn.com/explore
          </div>
        </div>

        <div className="dl-preview-app">
          <aside className="dl-preview-sidebar">
            <div className="dl-preview-brand">
              <span className="dl-preview-mark">D</span>
              <span>DentalLearn</span>
            </div>

            <div className="dl-preview-nav dl-preview-nav-active">
              <Video size={15} />
              <span>Explore</span>
            </div>

            <div className="dl-preview-nav">
              <Stethoscope size={15} />
              <span>Specialties</span>
            </div>

            <div className="dl-preview-nav">
              <Award size={15} />
              <span>Learning paths</span>
            </div>

            <div className="dl-preview-divider" />

            <div className="dl-preview-label">Your library</div>

            <div className="dl-preview-category">
              <span className="dl-category-dot dl-category-teal" />
              Saved videos
            </div>

            <div className="dl-preview-category">
              <span className="dl-category-dot dl-category-purple" />
              Recent learning
            </div>
          </aside>

          <div className="dl-preview-content">
            <div className="dl-preview-toolbar">
              <strong>Explore clinical learning</strong>

              <div className="dl-preview-toolbar-actions">
                <div className="dl-preview-search">
                  <Search size={12} />
                  Search videos
                </div>
                <div className="dl-preview-avatar">DR</div>
              </div>
            </div>

            <div className="dl-preview-main">
              <div className="dl-preview-video-card">
                <div className="dl-video-image">
                  <div className="dl-video-image-label">Clinical focus</div>
                  <div className="dl-video-play">
                    <Play size={18} fill="currentColor" />
                  </div>
                  <span className="dl-video-duration">18:42</span>
                </div>

                <div className="dl-video-card-copy">
                  <span className="dl-video-category">Implantology</span>
                  <strong>Predictable soft tissue management</strong>
                  <span>Dr. Hannah Lim · 2.4k views</span>
                </div>
              </div>

              <div className="dl-preview-video-list">
                <div className="dl-preview-list-heading">
                  <span>Recommended for you</span>
                  <span>View all</span>
                </div>

                <div className="dl-mini-video">
                  <div className="dl-mini-video-image dl-mini-video-one">
                    <Play size={12} fill="currentColor" />
                  </div>
                  <div>
                    <strong>Anterior aesthetics</strong>
                    <span>12 min · Aesthetics</span>
                  </div>
                </div>

                <div className="dl-mini-video">
                  <div className="dl-mini-video-image dl-mini-video-two">
                    <Play size={12} fill="currentColor" />
                  </div>
                  <div>
                    <strong>Modern endodontic workflow</strong>
                    <span>24 min · Endodontics</span>
                  </div>
                </div>

                <div className="dl-mini-video">
                  <div className="dl-mini-video-image dl-mini-video-three">
                    <Play size={12} fill="currentColor" />
                  </div>
                  <div>
                    <strong>Occlusion essentials</strong>
                    <span>16 min · Restorative</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dl-floating-card dl-floating-learning">
        <CheckCircle2 size={17} />
        <span>
          <strong>Learning progress</strong>
          <small>Pathway 68% complete</small>
        </span>
      </div>

      <div className="dl-floating-card dl-floating-community">
        <Users size={17} />
        <span>
          <strong>5,000+ clinicians</strong>
          <small>Learning together</small>
        </span>
      </div>
    </div>
  )
}

export function Landing() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  const redirectTo = search?.redirect ?? '/explore'
  const signupUrl = getSnabbbSignupUrl()

  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      void navigate({ to: redirectTo, replace: true })
    }
  }, [user, navigate, redirectTo])

  if (user) return null

  const closeMenu = () => setMenuOpen(false)

  return (
    <main className="dl-landing">
      <nav className="dl-nav" aria-label="Primary navigation">
        {/* <a className="dl-brand" href="#top" onClick={closeMenu}>
          <Logo clickable={false} imageClassName="dl-brand-logo" />
          <span>DentalLearn</span>
        </a> */}
        <img
          src="/logo/Snabbb (Teal).png"
          alt="Snabbb"
          className="dl-brand-logo"
        />

        <div className={`dl-nav-links ${menuOpen ? 'dl-nav-open' : ''}`}>
          <a href="#features" onClick={closeMenu}>
            Features
          </a>

          <a href="#workflow" onClick={closeMenu}>
            How it works
          </a>

          <a href="#faq" onClick={closeMenu}>
            FAQ
          </a>

          <div className="dl-mobile-actions">
            <Link to="/login" onClick={closeMenu}>
              Log in
            </Link>
            <a href={signupUrl} onClick={closeMenu}>
              Sign up
            </a>
          </div>
        </div>

        <div className="dl-nav-actions">
          {/* <ThemeToggle className="dl-theme-toggle" /> */}

          <Link className="dl-login" to="/login">
            Log in
          </Link>

          <a className="dl-nav-cta" href={signupUrl}>
            Sign up
            <ArrowRight size={16} />
          </a>
        </div>

        <button
          className="dl-menu-button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          type="button"
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </nav>

      <section id="top" className="dl-hero">
        <div className="dl-hero-copy">
          <div className="dl-eyebrow">
            <span className="dl-live-dot" />
            The future of dental education
          </div>

          <h1>
            Learn better dentistry,
            <em> together.</em>
          </h1>

          <p>
            Explore clinical videos, learn from trusted dental professionals,
            and build practical knowledge in one focused learning community.
          </p>

          <div className="dl-hero-actions">
            <a className="dl-primary-button" href={signupUrl}>
              Start learning
              <ArrowRight size={18} />
            </a>

            <Link className="dl-secondary-button" to="/explore">
              Browse videos
            </Link>
          </div>

          <div className="dl-trust-row">
            <span>
              <CheckCircle2 size={16} />
              Expert-led content
            </span>

            <span>
              <CheckCircle2 size={16} />
              Built for clinicians
            </span>

            <span>
              <CheckCircle2 size={16} />
              Learn at your pace
            </span>
          </div>
        </div>

        <LearningPreview />
      </section>

      <section className="dl-stat-strip" aria-label="DentalLearn highlights">
        <div>
          <strong>5k+</strong>
          <span>clinicians learning</span>
        </div>

        <div>
          <strong>4K</strong>
          <span>clinical video quality</span>
        </div>

        <div>
          <strong>24/7</strong>
          <span>access to learning</span>
        </div>
      </section>

      <section id="features" className="dl-section dl-features">
        <div className="dl-section-heading">
          <div className="dl-section-label">A focused learning ecosystem</div>
          <h2>Everything you need to keep improving.</h2>
          <p>
            Discover practical education, trusted perspectives, and a
            professional community designed around the realities of clinical
            practice.
          </p>
        </div>

        <div className="dl-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon

            return (
              <article className="dl-feature-card" key={feature.title}>
                <div className="dl-feature-icon">
                  <Icon size={22} />
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section id="workflow" className="dl-workflow">
        <div className="dl-section-heading">
          <div className="dl-section-label">A simple clinical learning loop</div>
          <h2>From curiosity to confidence.</h2>
          <p>
            Build a habit of learning that fits naturally into your workday,
            your study time, and your long-term professional goals.
          </p>
        </div>

        <div className="dl-workflow-grid">
          <div>
            <span>01</span>
            <strong>Discover</strong>
            <p>
              Find clinical videos, specialists, and subjects that match your
              interests.
            </p>
          </div>

          <div>
            <span>02</span>
            <strong>Understand</strong>
            <p>
              Watch detailed procedures and learn the thinking behind each
              clinical decision.
            </p>
          </div>

          <div>
            <span>03</span>
            <strong>Apply</strong>
            <p>
              Save useful lessons and bring new ideas into your next clinical
              conversation.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="dl-section dl-faq">
        <div className="dl-section-heading">
          <div className="dl-section-label">Questions</div>
          <h2>Good to know.</h2>
          <p>Some quick answers about learning with DentalLearn.</p>
        </div>

        <div className="dl-faq-list">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index

            return (
              <div
                className={`dl-faq-item ${isOpen ? 'is-open' : ''}`}
                key={faq.question}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <ChevronDown size={19} />
                </button>

                {isOpen && (
                  <div className="dl-faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="dl-final-cta">
        <div>
          <div className="dl-section-label">Your next lesson is waiting</div>
          <h2>Make every clinical moment count.</h2>
          <p>
            Join a growing community of dental professionals learning,
            sharing, and improving together.
          </p>
        </div>

        <a className="dl-light-button" href={signupUrl}>
          Join DentalLearn
          <ArrowRight size={18} />
        </a>
      </section>

      <footer className="dl-footer">
        {/* <a className="dl-brand" href="#top">
          <Logo clickable={false} imageClassName="dl-brand-logo" />
          <span>DentalLearn</span>
        </a> */}
        <img
          src="/logo/Snabbb (Teal).png"
          alt="Snabbb"
          className="dl-brand-logo"
        />

        <p>Clinical learning for a better standard of care.</p>

        <div className="dl-footer-links">
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <a href="#faq">FAQ</a>
        </div>
      </footer>
    </main>
  )
}