import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5 md:px-10">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 md:pr-4">
          <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 break-words text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="w-full min-w-0 md:w-auto md:shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
