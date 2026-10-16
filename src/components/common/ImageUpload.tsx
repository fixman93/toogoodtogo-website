import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { ImageKind } from '@/api/services'
import { Button } from '@/components/ui/button'
import { useUploadImage } from '@/hooks/api'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { SafeImage } from './SafeImage'

const MAX_BYTES = 12 * 1024 * 1024

/**
 * Pick a photo (gallery or camera on phones) → uploaded via the API to R2 →
 * `onChange(url)`. The server resizes/compresses it, so any phone photo works.
 */
export function ImageUpload({
  kind,
  value,
  onChange,
  shape = 'wide',
  label,
}: {
  kind: ImageKind
  value?: string
  onChange: (url: string) => void
  shape?: 'wide' | 'round'
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useUploadImage(kind)
  const [localError, setLocalError] = useState<string | null>(null)
  const error = localError ?? (upload.isError ? (upload.error instanceof ApiError ? upload.error.message : t('common.errorText')) : null)

  const pick = (file?: File) => {
    if (!file) return
    upload.reset()
    // Check size before uploading so a huge file doesn't waste mobile data.
    if (file.size > MAX_BYTES) return setLocalError(t('upload.tooLarge'))
    setLocalError(null)
    upload.mutate(file, { onSuccess: ({ url }) => onChange(url) })
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-semibold">{label}</p>}
      <div className={cn('flex gap-4', shape === 'round' ? 'items-center' : 'flex-col')}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={upload.isPending}
          aria-label={value ? t('upload.change') : t('upload.choose')}
          className={cn(
            'relative shrink-0 overflow-hidden border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary',
            shape === 'round' ? 'size-24 rounded-full' : 'aspect-[16/9] w-full rounded-2xl',
          )}
        >
          {value ? (
            <SafeImage src={value} alt="" className="size-full" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImagePlus className="size-7" />
              {shape === 'wide' && <span className="text-sm font-medium">{t('upload.choose')}</span>}
            </span>
          )}
          {upload.isPending && (
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 text-sm font-semibold text-white">
              <Loader2 className="size-5 animate-spin" />
              {shape === 'wide' && t('upload.uploading')}
            </span>
          )}
        </button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
            <Camera />
            {value ? t('upload.change') : t('upload.choose')}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" disabled={upload.isPending} onClick={() => onChange('')}>
              <Trash2 />
              {t('upload.remove')}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
