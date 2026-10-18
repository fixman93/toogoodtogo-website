import { Link } from 'react-router'
import { t } from '@/i18n'

/** "By signing up you accept the Terms and the Privacy policy" (links open in the app). */
export function ConsentNote({ kind }: { kind: 'register' | 'partner' }) {
  return (
    <p className="text-center text-xs leading-relaxed text-muted-foreground">
      {t(kind === 'register' ? 'legal.consentRegister' : 'legal.consentPartner')}{' '}
      <Link to="/terms" className="font-semibold text-primary underline">
        {t('legal.terms')}
      </Link>{' '}
      {t('legal.and')}{' '}
      <Link to="/privacy" className="font-semibold text-primary underline">
        {t('legal.privacy')}
      </Link>
      .
    </p>
  )
}
