import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { PartnerGuard } from './PartnerGuard'

/** Back link + header + partner-only guard, shared by portal sub-pages. */
export function PartnerPageShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <PageHeader title={title} subtitle={intro} />
      <PartnerGuard>{children}</PartnerGuard>
    </div>
  )
}
