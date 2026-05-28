import { cn } from '@/lib/utils'
import { CARD_BRAND_COLORS } from '@/lib/constants'
import type { CardBrand } from '@/lib/types'

const BRAND_INITIALS: Record<CardBrand, string> = {
  visa: 'VI',
  mastercard: 'MC',
  elo: 'EL',
  amex: 'AM',
  hipercard: 'HP',
  outros: 'CC',
}

const sizes = {
  xs: 'h-6 w-6 rounded text-[9px]',
  sm: 'h-8 w-8 rounded-lg text-[10px]',
  md: 'h-10 w-10 rounded-xl text-xs',
  lg: 'h-12 w-12 rounded-xl text-sm',
}

interface CreditCardIconProps {
  brand: CardBrand
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function CreditCardIcon({ brand, color, size = 'md', className }: CreditCardIconProps) {
  const bg = color ?? CARD_BRAND_COLORS[brand]
  const initials = BRAND_INITIALS[brand]

  return (
    <div
      style={{ backgroundColor: bg }}
      className={cn(
        'flex shrink-0 items-center justify-center font-bold text-white shadow-sm',
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
