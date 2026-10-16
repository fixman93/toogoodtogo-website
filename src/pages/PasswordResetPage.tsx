import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { authApi } from '@/api/services'
import { LogoMark } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : t('common.errorText'))

function Shell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-4 sm:py-10">
      <Card className="p-6 sm:p-8">
        <LogoMark className="mb-5 size-12" />
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        <div className="mt-6">{children}</div>
      </Card>
    </div>
  )
}

/** /forgot-password — e-mails a reset link (MailerSend). */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Shell title={t('auth.forgotTitle')} text={t('auth.forgotText')}>
      {sent ? (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {t('auth.forgotSent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={!email.includes('@') || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t('auth.forgotSubmit')}
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </Shell>
  )
}

/** /reset-password?token=… — sets the new password and signs in. */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(token ? null : t('auth.resetMissing'))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError(t('auth.passwordHint'))
    if (password !== repeat) return setError(t('auth.passwordsDiffer'))
    setPending(true)
    setError(null)
    try {
      await resetPassword(token, password)
      navigate('/profile', { replace: true })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Shell title={t('auth.resetTitle')} text={t('auth.resetText')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.newPassword')}</Label>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat">{t('auth.repeatPassword')}</Label>
          <PasswordInput id="repeat" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
        </div>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={!token || pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t('auth.resetSubmit')}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
          {t('auth.forgotTitle')}
        </Link>
      </p>
    </Shell>
  )
}
