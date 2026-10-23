/** Small building blocks of the /demo phone mockups. */
import type { ReactNode } from 'react'
import { DemoQr } from './DemoQr'

export function NextButton({ onClick, tone = '', children }: { onClick: () => void; tone?: '' | 'orange' | 'ghost'; children: ReactNode }) {
  return (
    <button type="button" className={`a-btn pulse ${tone}`} onClick={onClick}>
      {children}
    </button>
  )
}

interface OfferCardProps {
  title: string
  place: string
  km: string
  time: string
  price: string
  original: string
  left: number
  sweet?: boolean
}

export function OfferCard({ title, place, km, time, price, original, left, sweet }: OfferCardProps) {
  return (
    <div className="card">
      <div className={`offer-img ${sweet ? 'sweet' : ''}`}>
        <span className="left">Još {left}</span>
        <span className="logo">TP</span>
      </div>
      <div className="offer-body">
        <b>{title}</b>
        <span className="a-sub">
          {place} · {km}
        </span>
        <div className="offer-row">
          <span className="a-sub">Danas {time}</span>
          <span className="price">
            {price} <s>{original}</s>
          </span>
        </div>
      </div>
    </div>
  )
}

export function Push({ title, text }: { title: string; text: string }) {
  return (
    <div className="push">
      <span className="ic" />
      <div>
        <small>sada</small>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  )
}

export function Stats({ items }: { items: [string, string][] }) {
  return (
    <div className="stats">
      {items.map(([value, label]) => (
        <div className="stat" key={label}>
          <b>{value}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

export function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b>{children}</b>
    </div>
  )
}

export function Reservation({ banner, price }: { banner?: string; price: string }) {
  return (
    <>
      <div className="row">
        <span className="a-h grow">Rezervacija</span>
        <span className="badge">Potvrđeno</span>
      </div>
      <div className="card pad stack center">
        <DemoQr />
        <div className="code" style={{ fontSize: 20 }}>
          FN-4F7K
        </div>
        <span className="a-sub">Pokaži QR kod na kasi. Kese su spremne iza pulta.</span>
      </div>
      {banner && <div className="banner">{banner}</div>}
      <div className="card pad">
        <Kv label="Kesa">Kesa iznenađenja – pecivo</Kv>
        <Kv label="Preuzimanje">Danas 19:30–20:30</Kv>
        <Kv label="Plaćaš na kasi">{price}</Kv>
      </div>
    </>
  )
}
