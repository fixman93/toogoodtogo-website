import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDown, ArrowLeft, ArrowRight, Globe, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react'
import { Logo } from '@/components/common/Logo'
import { CountryPicker } from '@/features/demo/CountryPicker'
import { MARKET_NAME_EN } from '@/config/markets'
import { DEMO_COMMISSION_RATE, DEMO_MARKETS, demoMarketFor, demoStatement, type DemoMarket } from '@/features/demo/markets'
import { ACTOR_LABEL, CUSTOMER_NAV, PARTNER_NAV, demoSteps, type Screen } from '@/features/demo/steps'
import { language } from '@/i18n'
import '@/features/demo/demo.css'

/** This standalone presentation page isn't wired through t() — pick English copy directly from the global language toggle. */
const en = language === 'en'

/** How long each step stays on screen in auto-play. */
const STEP_MS = 7000
/** `/demo?zemlja=ba` picks the country; without it the page asks. */
const COUNTRY_PARAM = 'zemlja'
const THEME_KEY = 'foodnesi.demoTheme'
const SIDES = ['customer', 'partner'] as const

type Side = (typeof SIDES)[number]
type Theme = 'light' | 'dark'

const SIDE_LABEL: Record<Side, string> = en ? { customer: 'Customer', partner: 'Partner' } : { customer: 'Kupac', partner: 'Partner' }

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
  const hint = step.actor === 'both' && !seen.includes(other) ? (en ? `Also changing on the phone: ${SIDE_LABEL[other]}` : `Promena i na telefonu: ${SIDE_LABEL[other]}`) : ''
  const clock = /\d/.test(step.time) ? step.time : '21:10'

  return (
    <div ref={rootRef} className="fn-demo" data-theme={theme} style={{ '--sheet-h': `${sheetHeight}px` } as CSSProperties}>
      <div className="wrap">
        <header className="top">
          <Link to="/" aria-label={en ? 'Foodnesi home' : 'Foodnesi početna'}>
            <Logo light={theme === 'dark'} />
          </Link>
          <div className="top-links">
            <button type="button" className="country-btn" onClick={() => setPickerOpen(true)} aria-label={en ? `Country: ${MARKET_NAME_EN[country.code] ?? country.name}. Change` : `Zemlja: ${country.name}. Promeni`}>
              <Globe size={16} />
              {country.code} · {country.currencyLabel}
            </button>
            <Link to="/partner/apply" className="partner-link">
              {en ? 'Become a partner' : 'Postani partner'}
            </Link>
            <Link to="/">{en ? 'Open the app' : 'Otvori aplikaciju'}</Link>
            <button
              type="button"
              className="theme-btn"
              onClick={toggleTheme}
              aria-label={en ? (theme === 'dark' ? 'Turn on light theme' : 'Turn on dark theme') : theme === 'dark' ? 'Uključi svetlu temu' : 'Uključi tamnu temu'}
              title={en ? (theme === 'dark' ? 'Light theme' : 'Dark theme') : theme === 'dark' ? 'Svetla tema' : 'Tamna tema'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <section className="intro">
          <div>
            <div className="eyebrow">{en ? 'Demo · the full journey of one bag' : 'Demo · ceo tok jedne kese'}</div>
            <h1>
              {en ? (
                <>
                  From bakery surplus to a <em>saved bag</em> in 8 steps
                </>
              ) : (
                <>
                  Od viška u pekari do <em>spašene kese</em> za 8 koraka
                </>
              )}
            </h1>
          </div>
          <div>
            <p>
              {en
                ? 'Shops sell their end-of-day surplus as a surprise bag at a third of the price. The customer reserves it in the app, shows up in the pickup window and pays at the counter. Follow both phones, the customer’s and the partner’s, through the whole journey.'
                : 'Lokali na kraju dana prodaju višak hrane kao kesu iznenađenja po trećini cene. Kupac rezerviše u aplikaciji, dođe u termin i plati na kasi. Pratite oba telefona, kupca i partnera, kroz ceo tok.'}
            </p>
            <div className="facts">
              <span className="fact">{en ? 'Pay at the counter' : 'Plaćanje na kasi'}</span>
              <span className="fact">{en ? 'QR code for pickup' : 'QR kod za preuzimanje'}</span>
              <span className="fact">{en ? 'Web and iOS' : 'Web i iOS'}</span>
            </div>
            <button type="button" className="c-btn primary watch" onClick={watchDemo}>
              {en ? 'Watch the demo' : 'Pogledaj demo'} <ArrowDown size={18} />
            </button>
          </div>
        </section>

        <nav className="stepper" aria-label={en ? 'Demo steps' : 'Koraci demoa'}>
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
              {en ? (
                <>
                  Step {index + 1} of {steps.length} · {step.time}
                </>
              ) : (
                <>
                  Korak {index + 1} od {steps.length} · {step.time}
                </>
              )}
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
                {en ? '← Back' : '← Nazad'}
              </button>
              <button type="button" className="c-btn primary" onClick={forward}>
                {index === last ? (en ? 'Start over ↺' : 'Ispočetka ↺') : en ? 'Next →' : 'Dalje →'}
              </button>
              <button type="button" className="c-btn" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
                {playing ? (en ? '❚❚ Pause' : '❚❚ Pauza') : en ? '▶ Autoplay' : '▶ Automatski'}
              </button>
            </div>
            <div className="kbd">{en ? 'Arrow keys ← → on the keyboard, or click the buttons on the phones.' : 'Strelice ← → na tastaturi, ili kliknite dugmad u telefonima.'}</div>
          </div>

          <div className="switch" role="group" aria-label={en ? 'Show phone' : 'Prikaži telefon'}>
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
                {en ? 'Customer · Ana' : 'Kupac · Ana'}
              </div>
              <Phone key={`c${index}`} clock={clock} network="5G" screen={step.customer(forward)} nav={CUSTOMER_NAV} />
            </div>
          </div>

          <div className={`col col-partner ${acting('partner') ? 'acting' : ''}`}>
            <div className="phone-wrap">
              <div className="side-label">
                <span className="dot" />
                {en ? `Partner · Bakery ${country.area}` : `Partner · Pekara ${country.area}`}
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
            {en ? (
              <>Foodnesi · {MARKET_NAME_EN[country.code] ?? country.name} · prices in {country.currencyLabel} · names and numbers in the demo are examples</>
            ) : (
              <>
                Foodnesi · {country.name} · cene u {country.currencyLabel} · imena i brojke u demou su primeri
              </>
            )}
          </span>
          <Link to="/">{en ? 'Open the app' : 'Otvori aplikaciju'}</Link>
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
              aria-label={en ? `Step ${i + 1}: ${s.title}` : `Korak ${i + 1}: ${s.title}`}
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
              {en ? `Also see: ${SIDE_LABEL[other]} →` : `Pogledaj i: ${SIDE_LABEL[other]} →`}
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
          {en ? (expanded ? 'Less' : 'More details') : expanded ? 'Manje' : 'Više detalja'}
        </button>
        <div className="sheet-ctrl">
          <button type="button" className="c-btn" onClick={back} disabled={index === 0} aria-label={en ? 'Previous step' : 'Prethodni korak'}>
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className="c-btn"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={en ? (playing ? 'Pause' : 'Play automatically') : playing ? 'Pauziraj' : 'Pusti automatski'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button type="button" className="c-btn primary" onClick={forward}>
            {index === last ? (
              <>
                {en ? 'Start over' : 'Ispočetka'} <RotateCcw size={18} />
              </>
            ) : (
              <>
                {en ? 'Next' : 'Dalje'} <ArrowRight size={18} />
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

const ROLES_SR = [
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

const ROLES_EN = [
  {
    tag: 'Customer',
    title: 'Find, reserve, pick up',
    nav: 'Discover · Browse · Reservations · Favorites · Profile',
    items: [
      'Offers nearby, as a list or on a map',
      'Reserve up to 4 bags, QR code and email',
      'Delivery at shops that offer it, with live tracking',
      'Points, levels, challenges and inviting friends (−30% on their first bag)',
    ],
  },
  {
    tag: 'Partner',
    title: 'Publish surplus, hand out bags',
    nav: 'Portal · Orders · New offer · Scan · Profile',
    items: [
      'New offer in 3 steps, or a recurring offer by day',
      'QR code scanner and a counter screen with a sound for new orders',
      'Sales, monthly statement, donations',
      'Staff team, promo codes, boosted offers, API and webhook',
    ],
  },
  {
    tag: 'Foodnesi team',
    title: 'Approve and oversee',
    nav: '/admin · Applications · Users · Locations · Reviews',
    items: [
      'Approves “Become a partner” applications',
      'Pauses locations, blocks accounts, hides reviews',
      'Warning when a customer arrives but the code wasn’t scanned',
      'Log of every role change and moderation action',
    ],
  },
]

const ROLES = en ? ROLES_EN : ROLES_SR

function Roles() {
  return (
    <section className="band">
      <div className="wrap">
        <h2>{en ? 'Three sides of the platform' : 'Tri strane platforme'}</h2>
        <p className="lead">
          {en
            ? 'The same app has three roles. A role is assigned to an account, so a customer only becomes a partner once the Foodnesi team approves it.'
            : 'Ista aplikacija ima tri uloge. Uloga se dodeljuje nalogu, pa kupac postaje partner tek kad ga tim Foodnesi odobri.'}
        </p>
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

const RULES_SR: [string, string][] = [
  ['Otkazivanje', 'Kupac može da otkaže najkasnije 30 minuta pre početka preuzimanja.'],
  ['Isticanje', 'Rezervacija koja nije preuzeta ističe 60 minuta posle kraja termina.'],
  ['Dvostruko', 'Drugo skeniranje istog koda vraća „već preuzeta". Kesa se ne može izdati dva puta.'],
  ['Tuđ kod', 'Skener traži kod samo među lokacijama tog partnera. Kod za drugu lokaciju se odbija.'],
  ['Bez skena', 'Ako partner zaboravi da skenira, kupac sam potvrdi „Preuzeo/la sam". Partner to može da ospori.'],
  ['Ručno', 'Bez kamere: upiše se kod (FN-4F7K, fn4f7k i 4F7K rade isto) ili „Izdaj" na listi.'],
]

const RULES_EN: [string, string][] = [
  ['Cancellation', 'The customer can cancel up to 30 minutes before the pickup window starts.'],
  ['Expiry', 'A reservation that wasn’t picked up expires 60 minutes after the window ends.'],
  ['Duplicate', 'Scanning the same code again returns “already picked up”. A bag can’t be handed out twice.'],
  ['Someone else’s code', 'The scanner only looks for the code among that partner’s own locations. A code for another location is rejected.'],
  ['No scan', 'If the partner forgets to scan, the customer confirms “I picked it up” themselves. The partner can dispute it.'],
  ['Manual', 'Without a camera: type the code (FN-4F7K, fn4f7k and 4F7K all work) or use “Hand over” on the list.'],
]

const RULES = en ? RULES_EN : RULES_SR

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
        <h2>{en ? 'What happens to a reservation' : 'Šta se dešava sa rezervacijom'}</h2>
        <p className="lead">
          {en
            ? 'Every reservation has one status. The system changes it on its own when the window expires, and the partner and customer change it with their own actions.'
            : 'Svaka rezervacija ima jedan status. Sistem ga menja sam kad istekne termin, a partner i kupac ga menjaju svojim akcijama.'}
        </p>
        <div className="lifecycle">
          <svg viewBox="0 0 760 230" role="img" aria-label={en ? 'A reservation moves from Confirmed to Picked up, Cancelled or Expired' : 'Rezervacija ide iz statusa Potvrđena u Preuzeta, Otkazana ili Istekla'}>
            <defs>
              <marker id="fn-demo-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" style={{ fill: 'var(--fg-muted)' }} />
              </marker>
            </defs>
            <StatusNode x={20} y={87} w={190} label={en ? 'Confirmed' : 'Potvrđena'} sub={en ? 'right after reservation' : 'odmah po rezervaciji'} tone="main" />
            <Transition toY={42} labelY={52} label={en ? 'QR scan · manual code · “Hand over” · customer confirms' : 'QR sken · ručni kod · „Izdaj" · kupac potvrdi'} />
            <Transition toY={115} labelY={108} label={en ? 'customer (up to 30 min before) or partner' : 'kupac (do 30 min pre) ili partner'} />
            <Transition toY={188} labelY={184} label={en ? 'system, 60 min after the window' : 'sistem, 60 min posle termina'} />
            <StatusNode x={472} y={14} w={268} label={en ? 'Picked up' : 'Preuzeta'} sub={en ? 'paid at the counter · +10 points · rating' : 'plaćeno na kasi · +10 bodova · ocena'} tone="ok" />
            <StatusNode x={472} y={87} w={268} label={en ? 'Cancelled' : 'Otkazana'} sub={en ? 'the bag goes back into the offer' : 'kesa se vraća u ponudu'} tone="bad" />
            <StatusNode x={472} y={160} w={268} label={en ? 'Expired' : 'Istekla'} sub={en ? 'not picked up in the window' : 'nije preuzeta u terminu'} tone="warn" />
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
        <h2>{en ? 'How a shop becomes a partner' : 'Kako lokal postaje partner'}</h2>
        <p className="lead">{en ? 'From application to the first published bag usually takes one day, which is how long approval takes.' : 'Od prijave do prve objavljene kese obično prođe jedan dan, koliko traje odobrenje.'}</p>
        <ol className="onboard">
          <li>
            <b>{en ? 'Application' : 'Prijava'}</b>
            <span>{en ? 'The shop fills in “Become a partner”: name, address, category, contact.' : 'Lokal popuni „Postani partner": naziv, adresa, kategorija, kontakt.'}</span>
          </li>
          <li>
            <b>{en ? 'Approval' : 'Odobrenje'}</b>
            <span>{en ? 'The Foodnesi team reviews the application. The account gets the partner role and an email with the rules.' : 'Tim Foodnesi pregleda prijavu. Nalog dobija ulogu partnera i stiže e-mail sa pravilima.'}</span>
          </li>
          <li>
            <b>{en ? 'Location' : 'Lokacija'}</b>
            <span>{en ? 'Address, pin on the entrance, opening hours, pickup instructions, logo and cover photo.' : 'Adresa, pin na ulazu, radno vreme, uputstvo za preuzimanje, logo i naslovna slika.'}</span>
          </li>
          <li>
            <b>{en ? 'First bag' : 'Prva kesa'}</b>
            <span>{en ? 'A new offer in 3 steps. The quantity comes with a recommendation based on sales from the last 8 weeks.' : 'Nova ponuda u 3 koraka. Uz količinu stoji preporuka na osnovu prodaje iz poslednjih 8 nedelja.'}</span>
          </li>
        </ol>
        <div className="cta">
          <Link to="/partner/apply" className="c-btn primary">
            {en ? 'Become a partner' : 'Postani partner'}
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
          <h2>{en ? 'How the money moves' : 'Kako ide novac'}</h2>
          <p className="lead" style={{ marginBottom: 16 }}>
            {en
              ? 'The customer pays the shop at the counter, so the money stays with the partner right away. Foodnesi sends a commission statement once a month.'
              : 'Kupac plaća lokalu na kasi, pa novac odmah ostaje kod partnera. Foodnesi jednom mesečno šalje obračun provizije.'}
          </p>
          <p>
            {en
              ? `Commission is ${rate} on picked-up bags, at the rate that applied at the time of pickup. Discounts funded by Foodnesi (promo codes, friend discount) aren’t paid by the partner, so they’re deducted from the statement. Boosted offers are added.`
              : `Provizija je ${rate} na preuzete kese, po stopi koja je važila u trenutku preuzimanja. Popuste koje finansira Foodnesi (promo kodovi, popust od prijatelja) partner ne plaća, pa se oni odbijaju od obračuna. Istaknute ponude se dodaju.`}
          </p>
          <p>{en ? 'The example on the right illustrates one month for one location.' : 'Primer desno je ilustracija za jedan mesec jedne lokacije.'}</p>
        </div>
        <div className="ledger" aria-label={en ? 'Example monthly statement' : 'Primer mesečnog obračuna'}>
          <div className="kv">
            <span>{en ? 'Bags picked up' : 'Preuzete kese'}</span>
            <b>
              {month.bags} × {country.money(country.bagPrice)}
            </b>
          </div>
          <div className="kv">
            <span>{en ? 'Charged at the counter' : 'Promet na kasi'}</span>
            <b>{country.money(month.gross)}</b>
          </div>
          <div className="kv">
            <span>{en ? `Commission ${rate}` : `Provizija ${rate}`}</span>
            <b>{country.money(month.commission)}</b>
          </div>
          <div className="kv minus">
            <span>{en ? 'Discounts paid by Foodnesi' : 'Popusti koje plaća Foodnesi'}</span>
            <b>−{country.money(month.discounts)}</b>
          </div>
          <div className="kv plus">
            <span>{en ? 'Boosted “Top of the list” × 2' : 'Istaknuto „Na vrhu liste" × 2'}</span>
            <b>+{country.money(month.boosts)}</b>
          </div>
          <div className="kv total">
            <span>{en ? 'Owed to Foodnesi' : 'Za uplatu Foodnesi'}</span>
            <b>{country.money(month.total)}</b>
          </div>
        </div>
      </div>
    </section>
  )
}
