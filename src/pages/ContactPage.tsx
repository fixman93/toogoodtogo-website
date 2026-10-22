import { Link, useSearchParams } from 'react-router'
import type { ContactTopic } from '@/api/services'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContactForm } from '@/features/contact/ContactForm'
import { t } from '@/i18n'

/** ?tema=partnerstvo (links from the partner pages). */
const FROM_PARAM: Record<string, ContactTopic> = { partnerstvo: 'partnership', podrska: 'support', privatnost: 'privacy', drugo: 'other' }

/** /kontakt — public form; the message goes to the team's inbox by e-mail. */
export function ContactPage() {
  const [params] = useSearchParams()
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t('contact.title')} subtitle={t('contact.intro')} />
      <Card className="p-5 sm:p-6">
        <ContactForm
          defaultTopic={FROM_PARAM[params.get('tema') ?? ''] ?? 'other'}
          sentAction={
            <Button asChild variant="outline">
              <Link to="/">{t('contact.back')}</Link>
            </Button>
          }
        />
      </Card>
    </div>
  )
}
