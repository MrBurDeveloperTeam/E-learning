import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  imageClassName?: string
}

export function Logo({ className, imageClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {/* Light Mode Logo (Teal) */}
      <img
        src="/logo/Snabbb%20(Teal).png"
        alt="DentalLearn"
        className={cn("h-7 w-auto block dark:hidden object-contain", imageClassName)}
      />
      {/* Dark Mode Logo (White) */}
      <img
        src="/logo/Snabbb%20(White).png"
        alt="DentalLearn"
        className={cn("h-7 w-auto hidden dark:block object-contain", imageClassName)}
      />
    </div>
  )
}
