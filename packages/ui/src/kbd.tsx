import { cn } from './cn';

/** Consistent keyboard shortcut pill (e.g. ⌘K, esc, ↵). */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-600 shadow-sm',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
