import { Link, useRouteError } from 'react-router'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { isChunkLoadError } from '@/lib/chunks'

/** Shown instead of React Router's developer screen when a page crashes. */
export function RouteErrorPage() {
  const error = useRouteError()
  const newVersion = isChunkLoadError(error)
  if (!newVersion) console.error(error)
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <EmptyState
        icon={newVersion ? RefreshCw : TriangleAlert}
        title={newVersion ? t('common.newVersionTitle') : t('common.errorTitle')}
        text={newVersion ? t('common.newVersionText') : t('common.crashText')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw />
              {t('common.reload')}
            </Button>
            {!newVersion && (
              <Button asChild variant="outline">
                <a href="/">{t('common.goHome')}</a>
              </Button>
            )}
          </div>
        }
      />
      <p className="sr-only">
        <Link to="/">{t('common.goHome')}</Link>
      </p>
    </div>
  )
}
