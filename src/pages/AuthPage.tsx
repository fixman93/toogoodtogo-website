import { useState, type FormEvent } from 'react'
import { Link, useLocation as useRouterLocation, useNavigate, useSearchParams } from 'react-router'
import { Loader2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { LogoMark } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const [params] = useSearchParams()
  const referralCode = params.get('ref') ?? undefined
  const navigate = useNavigate()
  const from = (useRouterLocation().state as { from?: string } | null)?.from ?? '/profile'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isLogin = mode === 'login'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isLogin && form.password.length < 8) return setError(t('auth.passwordHint'))
    setPending(true)
    try {
      if (isLogin) await login(form.email, form.password)
      else await register(form.name, form.email, form.password, referralCode)
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
        <LogoMark className="mb-5 size-12" />
        <h1 className="text-2xl font-extrabold tracking-tight">{t(isLogin ? 'auth.loginTitle' : 'auth.registerTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(isLogin ? 'auth.loginSubtitle' : 'auth.registerSubtitle')}</p>

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
