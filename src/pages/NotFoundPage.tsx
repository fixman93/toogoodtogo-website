import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title={t('common.notFoundTitle')}
      action={
        <Button asChild>
          <Link to="/">{t('common.goHome')}</Link>
        </Button>
      }
    />
  )
}
