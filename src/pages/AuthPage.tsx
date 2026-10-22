import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation as useRouterLocation, useNavigate, useSearchParams } from 'react-router'
import { Gift, Loader2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { LogoFull } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LEGAL_PATHS } from '@/config/legal'
import { market } from '@/config/markets'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const [params] = useSearchParams()
  const referralCode = params.get('ref') ?? undefined
  const navigate = useNavigate()
  const from = (useRouterLocation().state as { from?: string } | null)?.from ?? '/profile'
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Terms checkbox: never pre-checked; required for registration (the API checks it too).
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [termsError, setTermsError] = useState(false)
  const termsBox = useRef<HTMLInputElement>(null)
  const isLogin = mode === 'login'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isLogin && form.phone.replace(/\D/g, '').length < 6) return setError(t('auth.phoneRequired'))
    if (!isLogin && form.password.length < 8) return setError(t('auth.passwordHint'))
    if (!isLogin && !acceptTerms) {
      setTermsError(true)
      termsBox.current?.focus()
      return
    }
    setPending(true)
    try {
      if (isLogin) await login(form.email, form.password)
      else await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, referralCode, acceptTerms })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.errorText'))
    } finally {
      setPending(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    id: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="mx-auto max-w-md py-4 sm:py-10">
      <Card className="p-6 sm:p-8">
        <LogoFull className="mb-6 h-14" />
        <h1 className="text-2xl font-extrabold tracking-tight">{t(isLogin ? 'auth.loginTitle' : 'auth.registerTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(isLogin ? 'auth.loginSubtitle' : 'auth.registerSubtitle')}</p>
        {!isLogin && referralCode && (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-accent/25 p-3 text-sm font-semibold">
            <Gift className="mt-0.5 size-4 shrink-0" />
            {t('referral.registerBanner')}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.name')}</Label>
              <Input {...field('name')} autoComplete="name" required minLength={2} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input {...field('email')} type="email" autoComplete="email" inputMode="email" required />
          </div>
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              <Input {...field('phone')} type="tel" autoComplete="tel" inputMode="tel" placeholder={market.phoneExample} required />
              <p className="text-xs text-muted-foreground">{t('auth.phoneHint')}</p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('auth.password')}</Label>
              {isLogin && (
                <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                  {t('auth.forgot')}
                </Link>
              )}
            </div>
            <PasswordInput {...field('password')} autoComplete={isLogin ? 'current-password' : 'new-password'} required />
            {!isLogin && <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>}
          </div>
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <input
                  ref={termsBox}
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked)
                    if (e.target.checked) setTermsError(false)
                  }}
                  aria-invalid={termsError || undefined}
                  aria-describedby={termsError ? 'terms-error' : undefined}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  {t('auth.termsBefore')}{' '}
                  {/* New tab: the filled-in form stays as it is. */}
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
              {termsError && (
                <p id="terms-error" role="alert" className="text-sm font-medium text-destructive">
                  {t('auth.termsRequired')}
                </p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t(isLogin ? 'auth.submitLogin' : 'auth.submitRegister')}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t(isLogin ? 'auth.noAccount' : 'auth.haveAccount')}{' '}
          <Link to={isLogin ? '/register' : '/login'} state={{ from }} className="font-semibold text-primary hover:underline">
            {t(isLogin ? 'auth.register' : 'auth.login')}
          </Link>
        </p>
      </Card>
    </div>
  )
}
