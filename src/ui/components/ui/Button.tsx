import * as React from 'react'
import { Slot } from 'radix-ui'
import { cn } from '@ui/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  className,
  asChild = false,
  ...props 
}: ButtonProps) {
  const Comp = asChild ? Slot : ('button' as any)
  
  return (
    <Comp
      className={cn(
        // Base Figma button styling - EXACT match
        'inline-flex items-center justify-center whitespace-nowrap',
        'rounded-md text-sm font-medium transition-colors border-none cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50',
        
        // Figma CSS variables - automatic theming
        'focus-visible:ring-[var(--figma-color-border-brand-strong)]',
        
        // Primary button - matches Figma exactly
        variant === 'primary' && [
          'bg-[var(--figma-color-bg-brand)]',
          'text-[var(--figma-color-text-onbrand)]',
          'hover:bg-[var(--figma-color-bg-brand-hover)]',
          'active:bg-[var(--figma-color-bg-brand-pressed)]'
        ],
        
        // Secondary button - matches Figma exactly  
        variant === 'secondary' && [
          'bg-[var(--figma-color-bg-secondary)]',
          'text-[var(--figma-color-text)]',
          'border border-[var(--figma-color-border)]',
          'hover:bg-[var(--figma-color-bg-hover)]'
        ],
        
        // Ghost button - matches Figma exactly
        variant === 'ghost' && [
          'text-[var(--figma-color-text)]',
          'hover:bg-[var(--figma-color-bg-hover)]'
        ],
        
        // Destructive button - matches Figma exactly
        variant === 'destructive' && [
          'bg-[var(--figma-color-bg-danger)]',
          'text-[var(--figma-color-text-ondanger)]',
          'hover:bg-[var(--figma-color-bg-danger-hover)]'
        ],
        
        // Figma size variants - EXACT pixel measurements
        size === 'sm' && 'h-8 px-3 text-xs',      // 32px height
        size === 'md' && 'h-9 px-4 py-2',         // 36px height  
        size === 'lg' && 'h-10 px-8',             // 40px height
        
        className
      )}
      {...props}
    />
  )
}
