import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { MARKET_NAME_EN } from '@/config/markets'
import { language } from '@/i18n'
import { DEMO_MARKETS, type DemoMarket } from './markets'

const en = language === 'en'

/**
 * Country choice for /demo. Opens by itself when the link has no `?zemlja=`;
 * it can only be closed without choosing once a country is already set.
 */
export function CountryPicker({ current, onPick, onClose }: { current: DemoMarket | null; onPick: (m: DemoMarket) => void; onClose?: () => void }) {
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="picker">
      <div className="picker-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="picker-card" role="dialog" aria-modal="true" aria-labelledby="fn-demo-picker-title">
        <div className="picker-head">
          <div>
            <div className="eyebrow">Foodnesi demo</div>
            <h2 id="fn-demo-picker-title">{en ? 'Choose a country' : 'Izaberite zemlju'}</h2>
          </div>
          {onClose && (
            <button type="button" className="theme-btn" onClick={onClose} aria-label={en ? 'Close' : 'Zatvori'}>
              <X size={18} />
            </button>
          )}
        </div>
        <p className="picker-lead">{en ? 'The demo shows a shop, city and prices in that country’s currency.' : 'Demo prikazuje lokal, grad i cene u valuti te zemlje.'}</p>
        <div className="picker-list">
          {DEMO_MARKETS.map((m, i) => (
            <button
              key={m.code}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              className={`picker-item ${current?.code === m.code ? 'on' : ''}`}
              aria-pressed={current?.code === m.code}
              onClick={() => onPick(m)}
            >
              <span className="picker-code">{m.code}</span>
              <span className="picker-text">
                <b>{en ? MARKET_NAME_EN[m.code] ?? m.name : m.name}</b>
                <span>
                  {m.city} · {en ? `prices in ${m.currencyLabel}` : `cene u ${m.currencyLabel}`}
                </span>
              </span>
              <span className="picker-price">{m.money(m.bagPrice)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
