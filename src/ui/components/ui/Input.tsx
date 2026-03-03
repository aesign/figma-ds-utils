import * as React from 'react'
import { cn } from '@ui/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        // Exact Figma input styling
        'flex h-9 w-full rounded-md border px-3 py-1',
        'text-sm transition-colors file:border-0 file:bg-transparent',
        'file:text-sm file:font-medium placeholder:text-[var(--figma-color-text-tertiary)]',
        'focus-visible:outline-none focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        
        // Figma CSS variables
        'bg-[var(--figma-color-bg)]',
        'border-[var(--figma-color-border)]',
        'text-[var(--figma-color-text)]',
        'focus-visible:border-[var(--figma-color-border-brand-strong)]',
        'focus-visible:ring-[var(--figma-color-border-brand-strong)]',
        
        className
      )}
      {...props}
    />
  )
}

