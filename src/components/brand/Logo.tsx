import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  imageClassName?: string
  clickable?: boolean
}

export function Logo({ className, imageClassName, clickable = true }: LogoProps) {
  const logoContent = (
    <>
      {/* Light Mode Logo (Teal) */}
      <img
        src="/logo/Snabbb%20(Teal).png"
        alt="Snabbb"
        className={cn("h-7 w-auto block dark:hidden object-contain", imageClassName)}
      />
      {/* Dark Mode Logo (White) */}
      <img
        src="/logo/Snabbb%20(White).png"
        alt="Snabbb"
        className={cn("h-7 w-auto hidden dark:block object-contain", imageClassName)}
      />
    </>
  )

  if (clickable) {
    return (
      <a
        href="https://app.snabbb.com/"
        className={cn("flex items-center hover:opacity-80 transition-opacity", className)}
        title="Go to Snabbb Home"
      >
        {logoContent}
      </a>
    )
  }

  return (
    <div className={cn("flex items-center", className)}>
      {logoContent}
    </div>
  )
}
