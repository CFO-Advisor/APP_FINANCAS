import { BANK_PRESETS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface BankIconProps {
  name: string
  color: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

function getInitials(name: string): string {
  const preset = BANK_PRESETS.find((b) => b.name.toLowerCase() === name.toLowerCase())
  if (preset) return preset.initials
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

const sizes = {
  xs: 'h-6 w-6 rounded text-[9px]',
  sm: 'h-8 w-8 rounded-lg text-[10px]',
  md: 'h-10 w-10 rounded-xl text-xs',
  lg: 'h-12 w-12 rounded-xl text-sm',
}

export function BankIcon({ name, color, size = 'md', className }: BankIconProps) {
  const initials = getInitials(name)
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center font-bold text-white shadow-sm',
        sizes[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}
