import { Cake, Croissant, ShoppingBasket, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { Category } from '@/api/types'

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  meals: UtensilsCrossed,
  bakery: Croissant,
  groceries: ShoppingBasket,
  sweets: Cake,
}
