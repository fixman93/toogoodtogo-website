import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDown, ArrowLeft, ArrowRight, Globe, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react'
import { Logo } from '@/components/common/Logo'
import { CountryPicker } from '@/features/demo/CountryPicker'
import { DEMO_COMMISSION_RATE, DEMO_MARKETS, demoMarketFor, demoStatement, type DemoMarket } from '@/features/demo/markets'
import { ACTOR_LABEL, CUSTOMER_NAV, PARTNER_NAV, demoSteps, type Screen } from '@/features/demo/steps'
import '@/features/demo/demo.css'

/** How long each step stays on screen in auto-play. */
const STEP_MS = 7000
/** `/demo?zemlja=ba` picks the country; without it the page asks. */
const COUNTRY_PARAM = 'zemlja'
const THEME_KEY = 'foodnesi.demoTheme'
const SIDES = ['customer', 'partner'] as const

type Side = (typeof SIDES)[number]
type Theme = 'light' | 'dark'

const SIDE_LABEL: Record<Side, string> = { customer: 'Kupac', partner: 'Partner' }

/** Follows the system theme until the viewer picks one with the toggle. */
function useDemoTheme() {
  const query = '(prefers-color-scheme: dark)'
  const [picked, setPicked] = useState<Theme | null>(() => {
    try {
      const value = localStorage.getItem(THEME_KEY)
      return value === 'light' || value === 'dark' ? value : null
    } catch {
      return null
    }
  })
  const [system, setSystem] = useState<Theme>(() => (window.matchMedia(query).matches ? 'dark' : 'light'))
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  const theme = picked ?? system
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setPicked(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* storage unavailable: keep it for this visit only */
    }
  }
  return [theme, toggle] as const
}

/**
 * Public walkthrough for presentations (/demo): the customer's and the
 * partner's phone side by side, going through one bag step by step. Lives
 * outside AppShell, so it works without an account or a location. On a phone
 * it becomes a player: one phone on screen, the explanation and controls in a
 * panel at the bottom, swipe to change steps.
 */
export default function DemoPage() {
  const [theme, toggleTheme] = useDemoTheme()
  const [params, setParams] = useSearchParams()
  const picked = demoMarketFor(params.get(COUNTRY_PARAM))
  const [pickerOpen, setPickerOpen] = useState(false)
  // Until a country is picked, the page behind the dialog shows the first one.
  const country = picked ?? DEMO_MARKETS[0]
  const steps = useMemo(() => demoSteps(country), [country])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // When only one phone fits, follow whoever acts unless the viewer picks a side.
  const [shown, setShown] = useState<Side>('partner')
  // Sides the viewer has looked at in this step (to point at the other phone when both change).
  const [seen, setSeen] = useState<Side[]>(['partner'])
  const [stageOnScreen, setStageOnScreen] = useState(false)
  const [sheetHeight, setSheetHeight] = useState(240)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const step = steps[index]
  const last = steps.length - 1

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, i))
    const actor = steps[next].actor
    const side = actor === 'both' ? shown : actor
    setIndex(next)
    setExpanded(false)
    setShown(side)
    setSeen([side])
  }, [shown, steps])
  const forward = useCallback(() => goTo(index >= last ? 0 : index + 1), [goTo, index, last])
  const back = useCallback(() => goTo(index - 1), [goTo, index])
  const pickCountry = (m: DemoMarket) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set(COUNTRY_PARAM, m.code.toLowerCase())
        return next
      },
      { replace: true },
    )
    setPickerOpen(false)
  }
  const closePicker = useCallback(() => setPickerOpen(false), [])
  const show = (side: Side) => {
    setShown(side)
    setSeen((list) => (list.includes(side) ? list : [...list, side]))
  }

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(forward, STEP_MS)
    return () => window.clearTimeout(timer)
  }, [playing, forward])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') forward()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [forward, back])

  useEffect(() => {
    const previous = document.title
    document.title = 'Foodnesi demo'
    return () => {
      document.title = previous
    }
  }, [])

  // The page behind the demo (overscroll, iOS bounce) should match its theme.
  useEffect(() => {
    const { body, documentElement } = document
    const previous = { background: body.style.backgroundColor, scheme: documentElement.style.colorScheme }
    if (rootRef.current) body.style.backgroundColor = getComputedStyle(rootRef.current).backgroundColor
    documentElement.style.colorScheme = theme
    return () => {
      body.style.backgroundColor = previous.background
      documentElement.style.colorScheme = previous.scheme
    }
  }, [theme])

  // The player panel is shown only while the phones are on screen.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new IntersectionObserver(([entry]) => setStageOnScreen(entry.isIntersecting), { rootMargin: '0px 0px -45% 0px' })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // Size the phone from the collapsed panel, so opening the details doesn't resize it.
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || expanded) return
    const observer = new ResizeObserver(() => {
      if (sheet.offsetHeight) setSheetHeight(sheet.offsetHeight)
    })
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [expanded])

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) forward()
    else if (index > 0) back()
  }

  const watchDemo = () => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const acting = (side: Side) => step.actor === 'both' || step.actor === side
  const other: Side = shown === 'customer' ? 'partner' : 'customer'
  const hint = step.actor === 'both' && !seen.includes(other) ? `Promena i na telefonu: ${SIDE_LABEL[other]}` : ''
  const clock = /\d/.test(step.time) ? step.time : '21:10'

  return (
    <div ref={rootRef} className="fn-demo" data-theme={theme} style={{ '--sheet-h': `${sheetHeight}px` } as CSSProperties}>
      <div className="wrap">
        <header className="top">
          <Link to="/" aria-label="Foodnesi početna">
            <Logo light={theme === 'dark'} />
          </Link>
          <div className="top-links">
            <button type="button" className="country-btn" onClick={() => setPickerOpen(true)} aria-label={`Zemlja: ${country.name}. Promeni`}>
              <Globe size={16} />
              {country.code} · {country.currencyLabel}
            </button>
            <Link to="/partner/apply" className="partner-link">
              Postani partner
            </Link>
            <Link to="/">Otvori aplikaciju</Link>
            <button
              type="button"
              className="theme-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Uključi svetlu temu' : 'Uključi tamnu temu'}
              title={theme === 'dark' ? 'Svetla tema' : 'Tamna tema'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <section className="intro">
          <div>
            <div className="eyebrow">Demo · ceo tok jedne kese</div>
            <h1>
              Od viška u pekari do <em>spašene kese</em> za 8 koraka
            </h1>
          </div>
          <div>
            <p>
              Lokali na kraju dana prodaju višak hrane kao kesu iznenađenja po trećini cene. Kupac rezerviše u aplikaciji, dođe u termin i plati
              na kasi. Pratite oba telefona, kupca i partnera, kroz ceo tok.
            </p>
            <div className="facts">
              <span className="fact">Plaćanje na kasi</span>
              <span className="fact">QR kod za preuzimanje</span>
              <span className="fact">Web i iOS</span>
            </div>
            <button type="button" className="c-btn primary watch" onClick={watchDemo}>
              Pogledaj demo <ArrowDown size={18} />
            </button>
          </div>
        </section>

        <nav className="stepper" aria-label="Koraci demoa">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`step-btn ${i === index ? 'active' : ''} ${i < index ? 'done' : ''}`}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => goTo(i)}
            >
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="t">{s.title}</span>
            </button>
          ))}
        </nav>

        <section ref={stageRef} className="stage" data-show={shown} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="narr" aria-live="polite">
            <div className="progress" aria-hidden="true">
              {playing && <i key={index} className="run" style={{ animationDuration: `${STEP_MS}ms` }} />}
            </div>
            <div className="when">
              Korak {index + 1} od {steps.length} · {step.time}
            </div>
            <span className="who">{ACTOR_LABEL[step.actor]}</span>
            <h2>{step.title}</h2>
            <p className="body">{step.body}</p>
            <ul>
              {step.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="ctrl">
              <button type="button" className="c-btn" onClick={back} disabled={index === 0}>
                ← Nazad
              </button>
              <button type="button" className="c-btn primary" onClick={forward}>
                {index === last ? 'Ispočetka ↺' : 'Dalje →'}
              </button>
              <button type="button" className="c-btn" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
                {playing ? '❚❚ Pauza' : '▶ Automatski'}
              </button>
            </div>
            <div className="kbd">Strelice ← → na tastaturi, ili kliknite dugmad u telefonima.</div>
          </div>

          <div className="switch" role="group" aria-label="Prikaži telefon">
            {SIDES.map((side) => (
              <button key={side} type="button" aria-pressed={shown === side} onClick={() => show(side)}>
                <span className={`dot ${acting(side) ? 'acting' : ''} ${acting(side) && !seen.includes(side) ? 'unseen' : ''}`} />
                {SIDE_LABEL[side]}
              </button>
            ))}
          </div>
          <div className="switch-hint" aria-live="polite">
            {hint}
          </div>

          <div className={`col col-customer ${acting('customer') ? 'acting' : ''}`}>
            <div className="phone-wrap">
              <div className="side-label">
                <span className="dot" />
                Kupac · Ana
              </div>
              <Phone key={`c${index}`} clock={clock} network="5G" screen={step.customer(forward)} nav={CUSTOMER_NAV} />
            </div>
          </div>

          <div className={`col col-partner ${acting('partner') ? 'acting' : ''}`}>
            <div className="phone-wrap">
              <div className="side-label">
                <span className="dot" />
                Partner · Pekara {country.area}
              </div>
              <Phone key={`p${index}`} clock={clock} network="Wi-Fi" screen={step.partner(forward)} nav={PARTNER_NAV} />
            </div>
          </div>
        </section>
      </div>

      <Roles />
      <Lifecycle />
      <Onboarding />
      <Money country={country} />

      <div className="wrap">
        <footer className="foot">
          <span>
            Foodnesi · {country.name} · cene u {country.currencyLabel} · imena i brojke u demou su primeri
          </span>
          <Link to="/">Otvori aplikaciju</Link>
        </footer>
      </div>

      {(!picked || pickerOpen) && <CountryPicker current={picked} onPick={pickCountry} onClose={picked ? closePicker : undefined} />}

      <div ref={sheetRef} className={`sheet ${stageOnScreen ? 'on' : ''} ${expanded ? 'open' : ''}`} inert={!stageOnScreen}>
        <div className="segs">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`seg ${i === index ? 'active' : ''} ${i < index ? 'done' : ''}`}
              aria-label={`Korak ${i + 1}: ${s.title}`}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => goTo(i)}
            >
              <i />
            </button>
          ))}
        </div>
        <div className="sheet-meta">
          <span>
            {index + 1} / {steps.length} · {step.time}
          </span>
          {hint ? (
            <button type="button" className="who" onClick={() => show(other)}>
              Pogledaj i: {SIDE_LABEL[other]} →
            </button>
          ) : (
            <span className="who">{ACTOR_LABEL[step.actor]}</span>
          )}
        </div>
        <h2>{step.title}</h2>
        <p className="sheet-body">{step.body}</p>
        {expanded && (
          <ul>
            {step.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <button type="button" className="more" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Manje' : 'Više detalja'}
        </button>
        <div className="sheet-ctrl">
          <button type="button" className="c-btn" onClick={back} disabled={index === 0} aria-label="Prethodni korak">
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className="c-btn"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={playing ? 'Pauziraj' : 'Pusti automatski'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button type="button" className="c-btn primary" onClick={forward}>
            {index === last ? (
              <>
                Ispočetka <RotateCcw size={18} />
              </>
            ) : (
              <>
                Dalje <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Phone({ clock, network, screen, nav }: { clock: string; network: string; screen: Screen; nav: string[] }) {
  return (
    <div className="phone">
      <div className="screen">
        <div className="notch" />
        <div className="statusbar">
          <span>{clock}</span>
          <span>{network} ▮▮▮</span>
        </div>
        <div className="app">{screen.content}</div>
        {screen.nav >= 0 && (
          <div className="nav">
            {nav.map((label, i) => (
              <span key={label} className={i === screen.nav ? 'on' : ''}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const ROLES = [
  {
    tag: 'Kupac',
    title: 'Pronađi, rezerviši, preuzmi',
    nav: 'Otkrij · Pretraga · Rezervacije · Omiljeno · Profil',
    items: [
      'Ponude u blizini, na listi ili na mapi',
      'Rezervacija do 4 kese, QR kod i e-mail',
      'Dostava kod lokala koji je nude, sa praćenjem uživo',
      'Bodovi, nivoi, izazovi i pozivanje prijatelja (−30% na prvu kesu)',
    ],
  },
  {
    tag: 'Partner',
    title: 'Objavi višak, izdaj kese',
    nav: 'Portal · Narudžbine · Nova ponuda · Skeniraj · Profil',
    items: [
      'Nova ponuda u 3 koraka ili ponavljajuća ponuda po danima',
      'Skener QR koda i ekran za kasu sa zvukom za novu narudžbu',
      'Prodaja, mesečni obračun, donacije',
      'Tim zaposlenih, promo kodovi, isticanje ponuda, API i webhook',
    ],
  },
  {
    tag: 'Foodnesi tim',
    title: 'Odobri i nadgledaj',
    nav: '/admin · Prijave · Korisnici · Lokacije · Ocene',
    items: [
      'Odobrava prijave „Postani partner"',
      'Pauzira lokacije, blokira naloge, skriva ocene',
      'Upozorenje kad kupac stigne a kod nije skeniran',
      'Dnevnik svih promena uloga i moderacije',
    ],
  },
]

function Roles() {
  return (
    <section className="band">
      <div className="wrap">
        <h2>Tri strane platforme</h2>
        <p className="lead">Ista aplikacija ima tri uloge. Uloga se dodeljuje nalogu, pa kupac postaje partner tek kad ga tim Foodnesi odobri.</p>
        <div className="grid3">
          {ROLES.map((r) => (
            <article className="role" key={r.tag}>
              <span className="tag">{r.tag}</span>
              <h3>{r.title}</h3>
              <div className="navline">{r.nav}</div>
              <ul>
                {r.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const RULES: [string, string][] = [
  ['Otkazivanje', 'Kupac može da otkaže najkasnije 30 minuta pre početka preuzimanja.'],
  ['Isticanje', 'Rezervacija koja nije preuzeta ističe 60 minuta posle kraja termina.'],
  ['Dvostruko', 'Drugo skeniranje istog koda vraća „već preuzeta". Kesa se ne može izdati dva puta.'],
  ['Tuđ kod', 'Skener traži kod samo među lokacijama tog partnera. Kod za drugu lokaciju se odbija.'],
  ['Bez skena', 'Ako partner zaboravi da skenira, kupac sam potvrdi „Preuzeo/la sam". Partner to može da ospori.'],
  ['Ručno', 'Bez kamere: upiše se kod (FN-4F7K, fn4f7k i 4F7K rade isto) ili „Izdaj" na listi.'],
]

type Tone = 'main' | 'ok' | 'bad' | 'warn'

function StatusNode({ x, y, w, label, sub, tone }: { x: number; y: number; w: number; label: string; sub: string; tone: Tone }) {
  const main = tone === 'main'
  return (
    <g>
      <rect x={x} y={y} width={w} height={56} rx={14} strokeWidth={1.5} style={{ fill: main ? 'var(--basil)' : 'var(--surface)', stroke: main ? 'var(--basil)' : 'var(--line)' }} />
      <text x={x + w / 2} y={y + 24} textAnchor="middle" fontSize={15} fontWeight={800} style={{ fill: main ? 'var(--on-basil)' : `var(--${tone})` }}>
        {label}
      </text>
      <text x={x + w / 2} y={y + 42} textAnchor="middle" fontSize={11.5} style={{ fill: main ? 'var(--on-basil)' : 'var(--fg-muted)' }}>
        {sub}
      </text>
    </g>
  )
}

function Transition({ toY, label, labelY }: { toY: number; label: string; labelY: number }) {
  const [x1, y1, x2] = [210, 115, 470]
  return (
    <>
      <path d={`M${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${toY}, ${x2} ${toY}`} fill="none" strokeWidth={1.5} markerEnd="url(#fn-demo-arrow)" style={{ stroke: 'var(--fg-muted)' }} />
      <text x={340} y={labelY} fontSize={12} textAnchor="middle" style={{ fill: 'var(--fg-muted)' }}>
        {label}
      </text>
    </>
  )
}

function Lifecycle() {
  return (
    <section className="band">
      <div className="wrap">
        <h2>Šta se dešava sa rezervacijom</h2>
        <p className="lead">Svaka rezervacija ima jedan status. Sistem ga menja sam kad istekne termin, a partner i kupac ga menjaju svojim akcijama.</p>
        <div className="lifecycle">
          <svg viewBox="0 0 760 230" role="img" aria-label="Rezervacija ide iz statusa Potvrđena u Preuzeta, Otkazana ili Istekla">
            <defs>
              <marker id="fn-demo-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" style={{ fill: 'var(--fg-muted)' }} />
              </marker>
            </defs>
            <StatusNode x={20} y={87} w={190} label="Potvrđena" sub="odmah po rezervaciji" tone="main" />
            <Transition toY={42} labelY={52} label={'QR sken · ručni kod · „Izdaj" · kupac potvrdi'} />
            <Transition toY={115} labelY={108} label="kupac (do 30 min pre) ili partner" />
            <Transition toY={188} labelY={184} label="sistem, 60 min posle termina" />
            <StatusNode x={472} y={14} w={268} label="Preuzeta" sub="plaćeno na kasi · +10 bodova · ocena" tone="ok" />
            <StatusNode x={472} y={87} w={268} label="Otkazana" sub="kesa se vraća u ponudu" tone="bad" />
            <StatusNode x={472} y={160} w={268} label="Istekla" sub="nije preuzeta u terminu" tone="warn" />
          </svg>
        </div>
        <div className="rules">
          {RULES.map(([name, text]) => (
            <div key={name}>
              <b>{name}</b>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Onboarding() {
  return (
    <section className="band">
      <div className="wrap">
        <h2>Kako lokal postaje partner</h2>
        <p className="lead">Od prijave do prve objavljene kese obično prođe jedan dan, koliko traje odobrenje.</p>
        <ol className="onboard">
          <li>
            <b>Prijava</b>
            <span>Lokal popuni „Postani partner": naziv, adresa, kategorija, kontakt.</span>
          </li>
          <li>
            <b>Odobrenje</b>
            <span>Tim Foodnesi pregleda prijavu. Nalog dobija ulogu partnera i stiže e-mail sa pravilima.</span>
          </li>
          <li>
            <b>Lokacija</b>
            <span>Adresa, pin na ulazu, radno vreme, uputstvo za preuzimanje, logo i naslovna slika.</span>
          </li>
          <li>
            <b>Prva kesa</b>
            <span>Nova ponuda u 3 koraka. Uz količinu stoji preporuka na osnovu prodaje iz poslednjih 8 nedelja.</span>
          </li>
        </ol>
        <div className="cta">
          <Link to="/partner/apply" className="c-btn primary">
            Postani partner
          </Link>
        </div>
      </div>
    </section>
  )
}

function Money({ country }: { country: DemoMarket }) {
  const month = demoStatement(country)
  const rate = `${DEMO_COMMISSION_RATE * 100}%`
  return (
    <section className="band">
      <div className="wrap money">
        <div>
          <h2>Kako ide novac</h2>
          <p className="lead" style={{ marginBottom: 16 }}>
            Kupac plaća lokalu na kasi, pa novac odmah ostaje kod partnera. Foodnesi jednom mesečno šalje obračun provizije.
          </p>
          <p>
            Provizija je {rate} na preuzete kese, po stopi koja je važila u trenutku preuzimanja. Popuste koje finansira Foodnesi (promo kodovi, popust
            od prijatelja) partner ne plaća, pa se oni odbijaju od obračuna. Istaknute ponude se dodaju.
          </p>
          <p>Primer desno je ilustracija za jedan mesec jedne lokacije.</p>
        </div>
        <div className="ledger" aria-label="Primer mesečnog obračuna">
          <div className="kv">
            <span>Preuzete kese</span>
            <b>
              {month.bags} × {country.money(country.bagPrice)}
            </b>
          </div>
          <div className="kv">
            <span>Promet na kasi</span>
            <b>{country.money(month.gross)}</b>
          </div>
          <div className="kv">
            <span>Provizija {rate}</span>
            <b>{country.money(month.commission)}</b>
          </div>
          <div className="kv minus">
            <span>Popusti koje plaća Foodnesi</span>
            <b>−{country.money(month.discounts)}</b>
          </div>
          <div className="kv plus">
            <span>Istaknuto „Na vrhu liste" × 2</span>
            <b>+{country.money(month.boosts)}</b>
          </div>
          <div className="kv total">
            <span>Za uplatu Foodnesi</span>
            <b>{country.money(month.total)}</b>
          </div>
        </div>
      </div>
    </section>
  )
}
