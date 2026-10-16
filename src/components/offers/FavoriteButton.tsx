import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { FavoriteTarget } from '@/api/types'
import { useAuth } from '@/features/auth/auth-context'
import { useFavoriteToggle } from '@/hooks/api'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export function FavoriteButton({
  targetType,
  targetId,
  className,
}: {
  targetType: FavoriteTarget
  targetId: string
  className?: string
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isFavorite, toggle } = useFavoriteToggle(targetType, targetId)

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={targetType === 'business' ? (isFavorite ? t('favorites.unfollowBusiness') : t('favorites.followBusiness')) : isFavorite ? t('offer.favoriteRemove') : t('offer.favoriteAdd')}
      title={targetType === 'business' ? (isFavorite ? t('favorites.unfollowBusiness') : t('favorites.followBusiness')) : undefined}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!user) navigate('/login')
        else toggle()
      }}
      className={cn(
        'flex size-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform active:scale-90',
        className,
      )}
    >
      <Heart className={cn('size-5 transition-colors', isFavorite ? 'fill-destructive text-destructive' : 'text-foreground')} />
    </button>
  )
}
