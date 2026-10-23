/**
 * Script of the /demo walkthrough: one surprise bag from the partner posting it
 * to the customer rating it. Each step draws both phones. The names and numbers
 * are examples (they match the seed data), not live data.
 */
import type { ReactNode } from 'react'
import { DemoQr } from './DemoQr'
import { DEMO_COMMISSION_RATE, demoStatement, type DemoMarket } from './markets'
import { Kv, NextButton, OfferCard, Push, Reservation, Stats } from './parts'

export type Actor = 'customer' | 'partner' | 'both'

export interface Screen {
  /** Highlighted bottom-nav tab, or -1 to hide the nav (lock screen). */
  nav: number
  content: ReactNode
}

export interface DemoStep {
  title: string
  time: string
  actor: Actor
  body: string
  points: string[]
  customer: (next: () => void) => Screen
  partner: (next: () => void) => Screen
}

export const CUSTOMER_NAV = ['Otkrij', 'Pretraga', 'Rezervacije', 'Omiljeno', 'Profil']
export const PARTNER_NAV = ['Portal', 'Narudžbine', 'Nova ponuda', 'Skeniraj', 'Profil']

export const ACTOR_LABEL: Record<Actor, string> = {
  customer: 'Radi kupac',
  partner: 'Radi partner',
  both: 'Oba telefona',
}

/** The steps for one country: its bakery, city and prices. */
export function demoSteps(d: DemoMarket): DemoStep[] {
  const shop = `Test Pekara – ${d.area}`
  const price = d.money(d.bagPrice)
  const value = d.money(d.bagValue)
  const month = demoStatement(d)

  return [
    {
      title: 'Partner objavljuje kesu',
      time: '16:10',
      actor: 'partner',
      body: 'Pekara vidi šta će ostati do zatvaranja i objavi kesu iznenađenja. Tri koraka, manje od minut.',
      points: [
        'Može da ponovi raniju kesu jednim dodirom',
        'Preporuka koliko kesa na osnovu prodaje istog dana u nedelji',
        'Ponavljajuća ponuda se objavljuje sama, svakog izabranog dana',
      ],
      customer: () => ({
        nav: -1,
        content: (
          <div className="lock">
            <div className="clock">16:11</div>
            <div className="date">utorak, 21. oktobar</div>
            <Push title="Foodnesi" text={`Test Pekara – ${d.area}, koju pratiš, ima novu kesu: Kesa iznenađenja – pecivo, ${price}.`} />
          </div>
        ),
      }),
      partner: (next) => ({
        nav: 2,
        content: (
          <>
            <span className="a-h">Nova ponuda</span>
            <div className="steps3">
              <div className="s3">
                <i>✓</i>
                <div>
                  <b>Lokacija</b>
                  <span>{shop}</span>
                </div>
              </div>
              <div className="s3">
                <i>✓</i>
                <div>
                  <b>Kesa</b>
                  <span>Ponovi: Kesa iznenađenja – pecivo</span>
                </div>
              </div>
              <div className="s3">
                <i>3</i>
                <div>
                  <b>Proveri i objavi</b>
                </div>
              </div>
            </div>
            <div className="card pad">
              <Kv label="Količina">
                <span className="stepper-q">− 6 +</span>
              </Kv>
              <Kv label="Cena / vrednost">
                {price} / {value}
              </Kv>
              <Kv label="Preuzimanje">Danas 19:30–20:30</Kv>
            </div>
            <div className="hint">
              Utorkom prodaš <b>5 od 6</b> kesa. Preporuka: <b>6</b>.
            </div>
            <div className="push-end">
              <NextButton onClick={next}>Objavi ponudu</NextButton>
            </div>
          </>
        ),
      }),
    },
    {
      title: 'Kupac pronalazi ponudu',
      time: '17:05',
      actor: 'customer',
      body: 'Ana otvori aplikaciju i vidi kese u blizini, sortirane po udaljenosti od njene lokacije.',
      points: ['Lista ili mapa sa cenama na pinovima', 'Filteri: kategorija, cena, dan i deo dana', 'Pratioci lokala dobiju obaveštenje o novoj kesi'],
      customer: (next) => ({
        nav: 0,
        content: (
          <>
            <div className="a-loc">
              Vaša lokacija: <b>
                {d.city}, {d.area}
              </b>
            </div>
            <div className="chips">
              <span className="chip on">Sve</span>
              <span className="chip">Obroci</span>
              <span className="chip">Pekara</span>
              <span className="chip">Slatkiši</span>
            </div>
            <button type="button" className="tappable" onClick={next}>
              <OfferCard title="Kesa iznenađenja – pecivo" place={shop} km="0,8 km" time="19:30–20:30" price={price} original={value} left={6} />
            </button>
            <OfferCard
              title="Slatka kesa"
              place={`Test Pekara – ${d.otherArea}`}
              km="2,1 km"
              time="18:00–19:00"
              price={d.money(d.sweetPrice)}
              original={d.money(d.sweetValue)}
              left={3}
              sweet
            />
          </>
        ),
      }),
      partner: () => ({
        nav: 0,
        content: (
          <>
            <span className="a-h">Portal</span>
            <span className="a-sub">Danas, utorak</span>
            <Stats items={[['6', 'objavljeno'], ['0', 'rezervisano'], ['0', 'preuzeto']]} />
            <div className="card pad stack">
              <div className="row">
                <b className="grow">Kesa iznenađenja – pecivo</b>
                <span className="badge ok">Aktivna</span>
              </div>
              <span className="a-sub">19:30–20:30 · {price} · 6 kesa</span>
              <div className="row">
                <span className="a-btn ghost center">Uredi</span>
                <span className="a-btn ghost center">Istakni</span>
              </div>
            </div>
            <div className="card pad">
              <b>Test Pekara – {d.otherArea}</b>
              <br />
              <span className="a-sub">1 aktivna ponuda</span>
            </div>
          </>
        ),
      }),
    },
    {
      title: 'Rezervacija jednim dodirom',
      time: '17:06',
      actor: 'customer',
      body: 'Na stranici ponude piše šta otprilike ima u kesi, alergeni, termin i koliko je ostalo. Ana bira količinu i rezerviše. Kartica nije potrebna.',
      points: ['Do 4 kese po rezervaciji', 'Promo kod ili −30% na prvu kesu preko prijatelja', 'Ruta do lokala pešice, autom ili biciklom'],
      customer: (next) => ({
        nav: 0,
        content: (
          <>
            <div className="card">
              <div className="offer-img">
                <span className="left">Još 6</span>
                <span className="logo">TP</span>
              </div>
              <div className="offer-body">
                <b style={{ fontSize: 14 }}>Kesa iznenađenja – pecivo</b>
                <span className="a-sub">
                  {shop} · {d.street}
                </span>
              </div>
            </div>
            <span className="a-sub">Hleb, kifle, peciva i pite koje ostanu na kraju dana.</span>
            <div className="chips">
              <span className="chip warn">gluten</span>
              <span className="chip warn">mleko</span>
              <span className="chip warn">jaja</span>
              <span className="chip">vegetarijansko</span>
            </div>
            <div className="card pad">
              <Kv label="Preuzimanje">Danas 19:30–20:30</Kv>
              <Kv label="Količina">
                <span className="stepper-q">− 1 +</span>
              </Kv>
              <Kv label="Imaš promo kod?">
                <span style={{ color: 'var(--basil)' }}>Unesi</span>
              </Kv>
            </div>
            <div className="push-end stack">
              <div className="offer-row">
                <span className="a-sub">Plaćaš na kasi</span>
                <span className="price">
                  {price} <s>{value}</s>
                </span>
              </div>
              <NextButton onClick={next} tone="orange">
                Rezerviši
              </NextButton>
            </div>
          </>
        ),
      }),
      partner: () => ({
        nav: 1,
        content: (
          <>
            <span className="a-h">Narudžbine</span>
            <div className="chips">
              <span className="chip on">Danas</span>
              <span className="chip">Sutra</span>
              <span className="chip">Sve</span>
            </div>
            <div className="card pad center" style={{ padding: '28px 12px' }}>
              <b>Još nema rezervacija</b>
              <br />
              <span className="a-sub">Nova narudžbina se pojavi ovde sama, uz zvuk na ekranu za kasu.</span>
            </div>
          </>
        ),
      }),
    },
    {
      title: 'Potvrda i QR kod',
      time: '17:06',
      actor: 'both',
      body: 'Rezervacija je potvrđena istog trenutka. Ana dobija QR kod u aplikaciji i e-mailom, a pekara push obaveštenje i novu karticu u narudžbinama.',
      points: [
        'QR sadrži ID rezervacije i kratak kod',
        'Kupac može da pošalje kesu prijatelju tajnim linkom',
        'Partner može i preko webhooka da primi narudžbinu u svoju kasu',
      ],
      customer: () => ({
        nav: 2,
        content: (
          <>
            <Reservation price={price} />
            <span className="a-sub center">Otkazivanje moguće do 19:00</span>
          </>
        ),
      }),
      partner: (next) => ({
        nav: 1,
        content: (
          <>
            <Push title="Nova rezervacija" text="Ana · 1 kesa · 19:30–20:30" />
            <span className="a-h">Narudžbine</span>
            <div className="card pad order stack">
              <div className="row">
                <b className="grow">Ana M.</b>
                <span className="badge orange">NOVO</span>
              </div>
              <span className="a-sub">Kesa iznenađenja – pecivo · 1 kesa</span>
              <div className="row">
                <span className="code">FN-4F7K</span>
                <span className="a-sub end">{price} na kasi</span>
              </div>
              <div className="row">
                <span className="a-btn ghost center">Otkaži</span>
                <span className="a-btn center">Izdaj</span>
              </div>
            </div>
            <Stats items={[['5', 'na stanju'], ['1', 'rezervisano'], ['0', 'preuzeto']]} />
            <div className="push-end">
              <NextButton onClick={next} tone="ghost">
                Dalje: kupac dolazi
              </NextButton>
            </div>
          </>
        ),
      }),
    },
    {
      title: 'Ana stiže u lokal',
      time: '19:42',
      actor: 'both',
      body: 'U terminu preuzimanja, kad je Ana do 50 m od lokala sa otvorenom rezervacijom, aplikacija potvrdi dolazak. Na kasi se pojavi oznaka da je kupac tu.',
      points: [
        'Lokacija se šalje samo kad je kupac blizu lokala',
        'Ako se kod tada ne skenira, tim Foodnesi dobija upozorenje',
        'Ekran za kasu drži tablet upaljen i pušta zvuk',
      ],
      customer: () => ({ nav: 2, content: <Reservation price={price} banner="Stigla si u lokal. Pokaži kod na kasi." /> }),
      partner: (next) => ({
        nav: 1,
        content: (
          <>
            <span className="a-h">Ekran za kasu</span>
            <span className="a-sub">{shop} · danas</span>
            <div className="card pad order stack">
              <div className="row">
                <b className="grow" style={{ fontSize: 15 }}>
                  Ana M.
                </b>
                <span className="badge ok">Kupac je stigao</span>
              </div>
              <span className="code" style={{ fontSize: 22 }}>
                FN-4F7K
              </span>
              <span className="a-sub">1 × Kesa iznenađenja – pecivo · {price}</span>
            </div>
            <div className="card pad order idle stack">
              <b>Marko P.</b>
              <span className="a-sub">2 kese · FN-9QX2 · {d.money(2 * d.bagPrice)}</span>
            </div>
            <div className="push-end">
              <NextButton onClick={next}>Skeniraj kod</NextButton>
            </div>
          </>
        ),
      }),
    },
    {
      title: 'Skeniranje na kasi',
      time: '19:43',
      actor: 'partner',
      body: 'Zaposleni uperi kameru u Anin telefon. Skener odmah kaže da li je kod važeći i koliko treba naplatiti.',
      points: [
        'Odbija prerane, istekle, otkazane i već preuzete kodove',
        'Kod se može i upisati ručno',
        'Zaposleni vide samo skener, narudžbine i ekran za kasu',
      ],
      customer: () => ({
        nav: 2,
        content: (
          <>
            <span className="a-h center">Pokaži na kasi</span>
            <div className="card pad stack center" style={{ flex: 1, alignContent: 'center', gap: 10 }}>
              <DemoQr className="big" />
              <div className="code" style={{ fontSize: 26 }}>
                FN-4F7K
              </div>
              <span className="a-sub">Osvetljenje ekrana je pojačano</span>
            </div>
          </>
        ),
      }),
      partner: (next) => ({
        nav: 3,
        content: (
          <>
            <span className="a-h">Skeniraj</span>
            <div className="cam">
              <div className="frame" />
              <DemoQr />
              <div className="scan" />
            </div>
            <div className="card pad result stack" style={{ gap: 4 }}>
              <span className="big">Važeći kod</span>
              <span>
                Izdaj <b>1 kesu</b> · Ana M.
              </span>
              <span>
                Naplati <b>{price}</b>
              </span>
            </div>
            <NextButton onClick={next}>Izdato</NextButton>
          </>
        ),
      }),
    },
    {
      title: 'Preuzeto',
      time: '19:43',
      actor: 'both',
      body: 'Rezervacija je označena kao preuzeta i plaćena. Anin ekran se sam osveži za nekoliko sekundi, bez ikakvog dodira.',
      points: ['+10 bodova po spašenoj kesi', 'Kesa se računa u Anin uticaj: kese, ušteda, CO₂', 'Partner u Prodaji vidi preuzeto i stanje'],
      customer: (next) => ({
        nav: 2,
        content: (
          <>
            <div className="row">
              <span className="a-h grow">Rezervacija</span>
              <span className="badge ok">Preuzeto ✓</span>
            </div>
            <div className="card pad stack center" style={{ padding: '20px 12px' }}>
              <div style={{ fontSize: 40, lineHeight: 1 }}>🥐</div>
              <b style={{ fontSize: 16 }}>Prijatno, Ana!</b>
              <span className="a-sub">Spasila si kesu hrane i uštedela {d.money(d.bagValue - d.bagPrice)}.</span>
              <span className="badge orange" style={{ margin: '4px auto 0' }}>
                +10 bodova
              </span>
            </div>
            <div className="card pad">
              <Kv label="Preuzeto">19:43</Kv>
              <Kv label="Plaćeno na kasi">{price}</Kv>
            </div>
            <div className="push-end">
              <NextButton onClick={next} tone="orange">
                Oceni kesu
              </NextButton>
            </div>
          </>
        ),
      }),
      partner: () => ({
        nav: 1,
        content: (
          <>
            <span className="a-h">Narudžbine</span>
            <div className="card pad order done stack" style={{ gap: 4 }}>
              <div className="row">
                <b className="grow">Ana M.</b>
                <span className="badge ok">Izdato</span>
              </div>
              <span className="a-sub">FN-4F7K · QR · 19:43</span>
            </div>
            <div className="card pad order stack" style={{ gap: 4 }}>
              <b>Marko P.</b>
              <span className="a-sub">2 kese · FN-9QX2 · čeka</span>
            </div>
            <span className="a-h" style={{ fontSize: 14, marginTop: 6 }}>
              Prodaja danas
            </span>
            <Stats items={[['6', 'objavljeno'], ['5', 'prodato'], ['1', 'preuzeto']]} />
          </>
        ),
      }),
    },
    {
      title: 'Ocena, bodovi i obračun',
      time: 'kasnije',
      actor: 'both',
      body: 'Ana ocenjuje kesu i dodaje sliku, koju će videti sledeći kupci. Pekara na kraju meseca dobija obračun provizije.',
      points: ['Nivoi: Početnik, Spasilac, Heroj hrane, Legenda', 'Izazov nedelje: 3 kese = dupli bodovi', 'Ocene i slike grade poverenje u lokal'],
      customer: () => ({
        nav: 4,
        content: (
          <>
            <span className="a-h">Kako je bilo?</span>
            <div className="card pad stack" style={{ gap: 8 }}>
              <span className="stars">★★★★★</span>
              <span>„Dve kifle, burek i pola vekne. Za {price}, odlično!"</span>
              <div className="photo-row">
                <span />
                <span />
                <span className="add">+</span>
              </div>
            </div>
            <div className="card pad stack">
              <div className="row">
                <b className="grow">Nivo: Spasilac</b>
                <span className="a-sub end">120 bodova</span>
              </div>
              <div className="lvl">
                <i style={{ width: '5%' }} />
              </div>
              <span className="a-sub">Još 380 bodova do nivoa „Heroj hrane"</span>
            </div>
            <Stats items={[['12', 'spašenih kesa'], [d.moneyWhole(12 * (d.bagValue - d.bagPrice)), 'ušteđeno'], ['32 kg', 'CO₂e manje']]} />
          </>
        ),
      }),
      partner: (restart) => ({
        nav: 0,
        content: (
          <>
            <span className="a-h">Obračun · oktobar</span>
            <div className="card pad">
              <Kv label="Preuzete kese">{month.bags}</Kv>
              <Kv label="Promet na kasi">{d.money(month.gross)}</Kv>
              <Kv label={`Provizija ${DEMO_COMMISSION_RATE * 100}%`}>{d.money(month.commission)}</Kv>
              <Kv label="Popusti Foodnesi">−{d.money(month.discounts)}</Kv>
              <Kv label="Istaknute ponude">+{d.money(month.boosts)}</Kv>
              <Kv label="Za uplatu">
                <span style={{ color: 'var(--basil)' }}>{d.money(month.total)}</span>
              </Kv>
            </div>
            <div className="card pad stack" style={{ gap: 2 }}>
              <div className="row">
                <b className="grow">Ocena lokala</b>
                <span className="stars end" style={{ fontSize: 13 }}>
                  ★ 4,8
                </span>
              </div>
              <span className="a-sub">86 ocena · nova: Ana M., 5★ sa slikom</span>
            </div>
            <button type="button" className="a-btn ghost" onClick={restart}>
              Pokreni demo ponovo
            </button>
          </>
        ),
      }),
    },
  ]
}
