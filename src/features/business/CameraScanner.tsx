import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2 } from 'lucide-react'
import QrScanner from 'qr-scanner'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

type CameraState = 'idle' | 'starting' | 'scanning' | 'error'

/**
 * Rear-camera QR scanner (qr-scanner: works in iOS Safari, Android Chrome and
 * desktop). Browsers only expose the camera on HTTPS or localhost.
 * `paused` keeps the camera on but ignores codes (e.g. while a result shows).
 */
export function CameraScanner({ onScan, paused }: { onScan: (text: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  const [state, setState] = useState<CameraState>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onScanRef.current = onScan
    pausedRef.current = paused
  }, [onScan, paused])

  useEffect(() => () => scannerRef.current?.destroy(), [])

  const start = async () => {
    if (!window.isSecureContext) {
      setState('error')
      setError(t('business.cameraInsecure'))
      return
    }
    setState('starting')
    setError(null)
    try {
      if (!(await QrScanner.hasCamera())) throw new Error('no-camera')
      scannerRef.current ??= new QrScanner(
        videoRef.current!,
        (result) => {
          if (!pausedRef.current) onScanRef.current(result.data)
        },
        { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
      )
      await scannerRef.current.start()
      setState('scanning')
    } catch (e) {
      setState('error')
      setError(e instanceof Error && e.message === 'no-camera' ? t('business.cameraMissing') : t('business.cameraDenied'))
    }
  }

  const stop = () => {
    scannerRef.current?.stop()
    setState('idle')
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground/90 sm:aspect-video">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        {state !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            {state === 'starting' ? <Loader2 className="size-10 animate-spin" /> : <Camera className="size-10 opacity-80" />}
            {state === 'starting' && <p className="text-sm">{t('business.cameraStarting')}</p>}
            {error && <p className="max-w-xs text-sm text-white/85">{error}</p>}
            {state !== 'starting' && (
              <Button variant="accent" size="lg" onClick={start}>
                <Camera />
                {t('business.startCamera')}
              </Button>
            )}
          </div>
        )}
      </div>
      {state === 'scanning' && (
        <Button variant="outline" className="w-full" onClick={stop}>
          <CameraOff />
          {t('business.stopCamera')}
        </Button>
      )}
    </div>
  )
}
