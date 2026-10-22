import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { FileCheck2, FileSignature, Loader2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LEGAL_PATHS, LEGAL_VERSIONS } from '@/config/legal'
import { useAuth } from '@/features/auth/auth-context'
import { useAcceptLegal } from '@/hooks/api'
import { usePartnerTermsPending } from './partner-terms'
import { t } from '@/i18n'
import { formatDate } from '@/lib/format'

/**
 * Partner portal: the owner accepts the partner rules (Prilog C) before publishing offers.
 * The API stores the version and time and refuses new offers until then. Opening the
 * page is not an acceptance — only the checkbox + button is.
 */
export function PartnerTermsNotice() {
  const { user, hasRole } = useAuth()
  const accept = useAcceptLegal()
  const [checked, setChecked] = useState(false)
  const [missing, setMissing] = useState(false)
  const legal = user?.legal
  if (!hasRole('business') || !legal) return null

  if (!legal.partnerTermsNeedsAcceptance) {
    return legal.partnerTermsAcceptedAt ? (
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <FileCheck2 className="size-3.5 shrink-0 text-success" />
        {t('partnerTerms.accepted', { date: formatDate(legal.partnerTermsAcceptedAt) })}
        <a href={LEGAL_PATHS.partnerTerms} target="_blank" rel="noopener" className="font-semibold text-primary underline">
          {t('partnerTerms.view')}
        </a>
      </p>
    ) : null
  }

  return (
    <Card className="space-y-3 border-accent p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <FileSignature className="size-5 text-primary" />
        {t('partnerTerms.title')}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{t('partnerTerms.intro')}</p>
      <a href={LEGAL_PATHS.partnerTerms} target="_blank" rel="noopener" className="inline-block text-sm font-semibold text-primary underline">
        {t('partnerTerms.read')}
      </a>
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            setChecked(e.target.checked)
            if (e.target.checked) setMissing(false)
          }}
          aria-invalid={missing || undefined}
          className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
        />
        <span>{t('partnerTerms.checkbox')}</span>
      </label>
      {missing && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t('partnerTerms.checkboxRequired')}
        </p>
      )}
      <Button
        disabled={accept.isPending}
        onClick={() => {
          if (!checked) return setMissing(true)
          accept.mutate({ document: 'partner_terms', version: LEGAL_VERSIONS.partnerTerms })
        }}
      >
        {accept.isPending && <Loader2 className="animate-spin" />}
        {t('partnerTerms.accept')}
      </Button>
      {accept.isError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {accept.error instanceof ApiError ? accept.error.message : t('common.errorText')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t('partnerTerms.contractNote')}{' '}
        <Link to="/kontakt?tema=partnerstvo" className="font-semibold text-primary underline">
          {t('partnerTerms.contact')}
        </Link>
      </p>
    </Card>
  )
}

/**
 * Wraps a "new offer / new location" form: until the rules are accepted it shows the
 * acceptance card instead (direct links and the nav button land here too). The API
 * enforces the same rule.
 */
export function PartnerTermsGate({ children }: { children: ReactNode }) {
  if (!usePartnerTermsPending()) return <>{children}</>
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <p role="status" className="text-sm font-medium">
        {t('partnerTerms.gate')}
      </p>
      <PartnerTermsNotice />
    </div>
  )
}
