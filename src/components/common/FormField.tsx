import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Label + control + hint/error. Pass the control's id as `htmlFor`. */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  )
}
