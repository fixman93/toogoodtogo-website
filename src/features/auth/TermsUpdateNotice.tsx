import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { LEGAL_PATHS, LEGAL_VERSIONS } from '@/config/legal'
import { useAuth } from '@/features/auth/auth-context'
import { useAcceptLegal } from '@/hooks/api'
import { t } from '@/i18n'

/**
 * Asks a signed-in user to accept updated terms — only when the API says so
 * (REACCEPT_FROM in backend/src/config/legal.ts). Earlier acceptances stay stored.
 */
export function TermsUpdateNotice() {
  const { user } = useAuth()
  const accept = useAcceptLegal()
  const [checked, setChecked] = useState(false)
  if (!user?.legal?.termsNeedsAcceptance) return null

  return (
    <div role="region" aria-label={t('termsUpdate.title')} className="mb-5 space-y-3 rounded-2xl border border-accent bg-accent/15 p-4">
      <p className="flex items-center gap-2 font-bold">
        <FileText className="size-4 shrink-0" />
        {t('termsUpdate.title')}
      </p>
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>
          {t('auth.termsBefore')}{' '}
          <a href={LEGAL_PATHS.terms} target="_blank" rel="noopener" className="font-semibold text-primary underline">
            {t('auth.termsLink')}
          </a>{' '}
          {t('auth.termsMiddle')}{' '}
          <a href={LEGAL_PATHS.privacy} target="_blank" rel="noopener" className="font-semibold text-primary underline">
            {t('auth.privacyLink')}
          </a>
          .
        </span>
      </label>
      <Button size="sm" disabled={!checked || accept.isPending} onClick={() => accept.mutate({ document: 'terms', version: LEGAL_VERSIONS.terms })}>
        {accept.isPending && <Loader2 className="animate-spin" />}
        {t('termsUpdate.accept')}
      </Button>
      {accept.isError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {accept.error instanceof ApiError ? accept.error.message : t('common.errorText')}
        </p>
      )}
    </div>
  )
}
