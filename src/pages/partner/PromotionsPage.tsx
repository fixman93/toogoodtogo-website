import { PartnerPageShell } from '@/features/business/PartnerPageShell'
import { PromotionsManager } from '@/features/promotions/PromotionsManager'
import { t } from '@/i18n'

export function PromotionsPage() {
  return (
    <PartnerPageShell title={t('promo.title')} intro={t('promo.intro')}>
      <PromotionsManager />
    </PartnerPageShell>
  )
}
