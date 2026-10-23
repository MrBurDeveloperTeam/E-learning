import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-5 md:flex-row md:items-start md:justify-between md:gap-0">
      <div className="min-w-0">
        <h1 className="page-heading">{title}</h1>
        {subtitle && <p className="page-subheading">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full items-center gap-2 md:ml-4 md:w-auto md:shrink-0">{actions}</div>}
    </div>
  )
}
