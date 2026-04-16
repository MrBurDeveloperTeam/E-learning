import { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Sidebar, type SidebarItem } from './Sidebar'
import { cn } from '../../lib/utils'

interface PageLayoutProps {
  children: ReactNode
  showSidebar?: boolean
  sidebarItems?: SidebarItem[]
  className?: string
  sidebarVariant?: 'default' | 'admin'
  scrollMain?: boolean
}

export function PageLayout({
  children,
  showSidebar,
  sidebarItems,
  className,
  sidebarVariant = 'default',
  scrollMain = true,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 max-w-[1400px] mx-auto w-full">
        {showSidebar && sidebarItems && (
          <Sidebar items={sidebarItems} variant={sidebarVariant} />
        )}
        <main className={cn(
          'flex-1 pb-16 md:pb-0',
          scrollMain && 'overflow-y-auto',
          showSidebar ? 'p-6' : 'p-0',
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}
