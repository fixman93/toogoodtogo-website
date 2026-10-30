/**
 * Script of the /demo walkthrough: one surprise bag from the partner posting it
 * to the customer rating it. Each step draws both phones. The names and numbers
 * are examples (they match the seed data), not live data.
 */
import type { ReactNode } from 'react'
import { language } from '@/i18n'
import { DemoQr } from './DemoQr'
import { DEMO_COMMISSION_RATE, demoStatement, type DemoMarket } from './markets'
import { Kv, NextButton, OfferCard, Push, Reservation, Stats } from './parts'

const en = language === 'en'

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

export const CUSTOMER_NAV = en ? ['Discover', 'Browse', 'Reservations', 'Favorites', 'Profile'] : ['Otkrij', 'Pretraga', 'Rezervacije', 'Omiljeno', 'Profil']
export const PARTNER_NAV = en ? ['Portal', 'Orders', 'New offer', 'Scan', 'Profile'] : ['Portal', 'Narudžbine', 'Nova ponuda', 'Skeniraj', 'Profil']

export const ACTOR_LABEL: Record<Actor, string> = en
  ? { customer: 'Customer acts', partner: 'Partner acts', both: 'Both phones' }
  : { customer: 'Radi kupac', partner: 'Radi partner', both: 'Oba telefona' }

/** The steps for one country: its bakery, city and prices. */
export function demoSteps(d: DemoMarket): DemoStep[] {
  const shop = `Test Pekara – ${d.area}`
  const price = d.money(d.bagPrice)
  const value = d.money(d.bagValue)
  const month = demoStatement(d)

  return [
    {
      title: en ? 'Partner publishes a bag' : 'Partner objavljuje kesu',
      time: '16:10',
      actor: 'partner',
      body: en
        ? 'The bakery sees what will be left at closing time and publishes a surprise bag. Three steps, under a minute.'
        : 'Pekara vidi šta će ostati do zatvaranja i objavi kesu iznenađenja. Tri koraka, manje od minut.',
      points: en
        ? [
            'Can repeat an earlier bag with one tap',
            'A recommended bag count based on sales on the same day of the week',
            'A recurring offer publishes itself on each chosen day',
          ]
        : [
            'Može da ponovi raniju kesu jednim dodirom',
            'Preporuka koliko kesa na osnovu prodaje istog dana u nedelji',
            'Ponavljajuća ponuda se objavljuje sama, svakog izabranog dana',
          ],
      customer: () => ({
        nav: -1,
        content: (
          <div className="lock">
            <div className="clock">16:11</div>
            <div className="date">{en ? 'Tuesday, October 21' : 'utorak, 21. oktobar'}</div>
            <Push
              title="Foodnesi"
              text={
                en
                  ? `Test Bakery – ${d.area}, which you follow, has a new bag: Surprise bag – pastries, ${price}.`
                  : `Test Pekara – ${d.area}, koju pratiš, ima novu kesu: Kesa iznenađenja – pecivo, ${price}.`
              }
            />
          </div>
        ),
      }),
      partner: (next) => ({
        nav: 2,
        content: (
          <>
            <span className="a-h">{en ? 'New offer' : 'Nova ponuda'}</span>
            <div className="steps3">
              <div className="s3">
                <i>✓</i>
                <div>
                  <b>{en ? 'Location' : 'Lokacija'}</b>
                  <span>{shop}</span>
                </div>
              </div>
              <div className="s3">
                <i>✓</i>
                <div>
                  <b>{en ? 'Bag' : 'Kesa'}</b>
                  <span>{en ? 'Repeat: Surprise bag – pastries' : 'Ponovi: Kesa iznenađenja – pecivo'}</span>
                </div>
              </div>
              <div className="s3">
                <i>3</i>
                <div>
                  <b>{en ? 'Review and publish' : 'Proveri i objavi'}</b>
                </div>
              </div>
            </div>
            <div className="card pad">
              <Kv label={en ? 'Quantity' : 'Količina'}>
                <span className="stepper-q">− 6 +</span>
              </Kv>
              <Kv label={en ? 'Price / value' : 'Cena / vrednost'}>
                {price} / {value}
              </Kv>
              <Kv label={en ? 'Pickup' : 'Preuzimanje'}>{en ? 'Today 19:30–20:30' : 'Danas 19:30–20:30'}</Kv>
            </div>
            <div className="hint">
              {en ? (
                <>
                  On Tuesdays you sell <b>5 of 6</b> bags. Recommendation: <b>6</b>.
                </>
              ) : (
                <>
                  Utorkom prodaš <b>5 od 6</b> kesa. Preporuka: <b>6</b>.
                </>
              )}
            </div>
            <div className="push-end">
              <NextButton onClick={next}>{en ? 'Publish offer' : 'Objavi ponudu'}</NextButton>
            </div>
          </>
        ),
      }),
    },
    {
      title: en ? 'Customer finds the offer' : 'Kupac pronalazi ponudu',
      time: '17:05',
      actor: 'customer',
      body: en ? 'Ana opens the app and sees bags nearby, sorted by distance from her location.' : 'Ana otvori aplikaciju i vidi kese u blizini, sortirane po udaljenosti od njene lokacije.',
      points: en
        ? ['A list or a map with prices on the pins', 'Filters: category, price, day and time of day', 'Followers of the shop get notified about the new bag']
        : ['Lista ili mapa sa cenama na pinovima', 'Filteri: kategorija, cena, dan i deo dana', 'Pratioci lokala dobiju obaveštenje o novoj kesi'],
      customer: (next) => ({
        nav: 0,
        content: (
          <>
            <div className="a-loc">
              {en ? 'Your location: ' : 'Vaša lokacija: '}
              <b>
                {d.city}, {d.area}
              </b>
            </div>
            <div className="chips">
              <span className="chip on">{en ? 'All' : 'Sve'}</span>
              <span className="chip">{en ? 'Meals' : 'Obroci'}</span>
              <span className="chip">{en ? 'Bakery' : 'Pekara'}</span>
              <span className="chip">{en ? 'Sweets' : 'Slatkiši'}</span>
            </div>
            <button type="button" className="tappable" onClick={next}>
              <OfferCard title={en ? 'Surprise bag – pastries' : 'Kesa iznenađenja – pecivo'} place={shop} km="0.8 km" time="19:30–20:30" price={price} original={value} left={6} />
            </button>
            <OfferCard
              title={en ? 'Sweet bag' : 'Slatka kesa'}
              place={en ? `Test Bakery – ${d.otherArea}` : `Test Pekara – ${d.otherArea}`}
              km="2.1 km"
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
            <span className="a-sub">{en ? 'Today, Tuesday' : 'Danas, utorak'}</span>
            <Stats
              items={
                en
                  ? [['6', 'published'], ['0', 'reserved'], ['0', 'picked up']]
                  : [['6', 'objavljeno'], ['0', 'rezervisano'], ['0', 'preuzeto']]
              }
            />
            <div className="card pad stack">
              <div className="row">
                <b className="grow">{en ? 'Surprise bag – pastries' : 'Kesa iznenađenja – pecivo'}</b>
                <span className="badge ok">{en ? 'Active' : 'Aktivna'}</span>
              </div>
              <span className="a-sub">{en ? `19:30–20:30 · ${price} · 6 bags` : `19:30–20:30 · ${price} · 6 kesa`}</span>
              <div className="row">
                <span className="a-btn ghost center">{en ? 'Edit' : 'Uredi'}</span>
                <span className="a-btn ghost center">{en ? 'Boost' : 'Istakni'}</span>
              </div>
            </div>
            <div className="card pad">
              <b>{en ? `Test Bakery – ${d.otherArea}` : `Test Pekara – ${d.otherArea}`}</b>
              <br />
              <span className="a-sub">{en ? '1 active offer' : '1 aktivna ponuda'}</span>
            </div>
          </>
        ),
      }),
    },
    {
      title: en ? 'One-tap reservation' : 'Rezervacija jednim dodirom',
      time: '17:06',
      actor: 'customer',
      body: en
        ? 'The offer page shows roughly what’s in the bag, allergens, the time window and how many are left. Ana picks a quantity and reserves. No card needed.'
        : 'Na stranici ponude piše šta otprilike ima u kesi, alergeni, termin i koliko je ostalo. Ana bira količinu i rezerviše. Kartica nije potrebna.',
      points: en
        ? ['Up to 4 bags per reservation', 'Promo code or −30% on the first bag via a friend', 'Route to the shop on foot, by car or by bike']
        : ['Do 4 kese po rezervaciji', 'Promo kod ili −30% na prvu kesu preko prijatelja', 'Ruta do lokala pešice, autom ili biciklom'],
      customer: (next) => ({
        nav: 0,
        content: (
          <>
            <div className="card">
              <div className="offer-img">
                <span className="left">{en ? '6 left' : 'Još 6'}</span>
                <span className="logo">TP</span>
              </div>
              <div className="offer-body">
                <b style={{ fontSize: 14 }}>{en ? 'Surprise bag – pastries' : 'Kesa iznenađenja – pecivo'}</b>
                <span className="a-sub">
                  {shop} · {d.street}
                </span>
              </div>
            </div>
            <span className="a-sub">{en ? 'Bread, rolls, pastries and pies left at the end of the day.' : 'Hleb, kifle, peciva i pite koje ostanu na kraju dana.'}</span>
            <div className="chips">
              <span className="chip warn">{en ? 'gluten' : 'gluten'}</span>
              <span className="chip warn">{en ? 'milk' : 'mleko'}</span>
              <span className="chip warn">{en ? 'eggs' : 'jaja'}</span>
              <span className="chip">{en ? 'vegetarian' : 'vegetarijansko'}</span>
            </div>
            <div className="card pad">
              <Kv label={en ? 'Pickup' : 'Preuzimanje'}>{en ? 'Today 19:30–20:30' : 'Danas 19:30–20:30'}</Kv>
              <Kv label={en ? 'Quantity' : 'Količina'}>
                <span className="stepper-q">− 1 +</span>
              </Kv>
              <Kv label={en ? 'Have a promo code?' : 'Imaš promo kod?'}>
                <span style={{ color: 'var(--basil)' }}>{en ? 'Enter' : 'Unesi'}</span>
              </Kv>
            </div>
            <div className="push-end stack">
              <div className="offer-row">
                <span className="a-sub">{en ? 'Pay at the counter' : 'Plaćaš na kasi'}</span>
                <span className="price">
                  {price} <s>{value}</s>
                </span>
              </div>
              <NextButton onClick={next} tone="orange">
                {en ? 'Reserve' : 'Rezerviši'}
              </NextButton>
            </div>
          </>
        ),
      }),
      partner: () => ({
        nav: 1,
        content: (
          <>
            <span className="a-h">{en ? 'Orders' : 'Narudžbine'}</span>
            <div className="chips">
              <span className="chip on">{en ? 'Today' : 'Danas'}</span>
              <span className="chip">{en ? 'Tomorrow' : 'Sutra'}</span>
              <span className="chip">{en ? 'All' : 'Sve'}</span>
            </div>
            <div className="card pad center" style={{ padding: '28px 12px' }}>
              <b>{en ? 'No reservations yet' : 'Još nema rezervacija'}</b>
              <br />
              <span className="a-sub">{en ? 'A new order appears here on its own, with a sound on the counter screen.' : 'Nova narudžbina se pojavi ovde sama, uz zvuk na ekranu za kasu.'}</span>
            </div>
          </>
        ),
      }),
    },
    {
      title: en ? 'Confirmation and QR code' : 'Potvrda i QR kod',
      time: '17:06',
      actor: 'both',
      body: en
        ? 'The reservation is confirmed instantly. Ana gets a QR code in the app and by email, and the bakery gets a push notification and a new card in orders.'
        : 'Rezervacija je potvrđena istog trenutka. Ana dobija QR kod u aplikaciji i e-mailom, a pekara push obaveštenje i novu karticu u narudžbinama.',
      points: en
        ? ['The QR contains the reservation ID and a short code', 'A customer can send the bag to a friend with a secret link', 'A partner can also receive the order in their own POS via webhook']
        : [
            'QR sadrži ID rezervacije i kratak kod',
            'Kupac može da pošalje kesu prijatelju tajnim linkom',
            'Partner može i preko webhooka da primi narudžbinu u svoju kasu',
          ],
      customer: () => ({
        nav: 2,
        content: (
          <>
            <Reservation price={price} />
            <span className="a-sub center">{en ? 'Cancellation possible until 19:00' : 'Otkazivanje moguće do 19:00'}</span>
          </>
        ),
      }),
      partner: (next) => ({
        nav: 1,
        content: (
          <>
            <Push title={en ? 'New reservation' : 'Nova rezervacija'} text={en ? 'Ana · 1 bag · 19:30–20:30' : 'Ana · 1 kesa · 19:30–20:30'} />
            <span className="a-h">{en ? 'Orders' : 'Narudžbine'}</span>
            <div className="card pad order stack">
              <div className="row">
                <b className="grow">Ana M.</b>
                <span className="badge orange">{en ? 'NEW' : 'NOVO'}</span>
              </div>
              <span className="a-sub">{en ? 'Surprise bag – pastries · 1 bag' : 'Kesa iznenađenja – pecivo · 1 kesa'}</span>
              <div className="row">
                <span className="code">FN-4F7K</span>
                <span className="a-sub end">{en ? `${price} at the counter` : `${price} na kasi`}</span>
              </div>
              <div className="row">
                <span className="a-btn ghost center">{en ? 'Cancel' : 'Otkaži'}</span>
                <span className="a-btn center">{en ? 'Hand over' : 'Izdaj'}</span>
              </div>
            </div>
            <Stats
              items={en ? [['5', 'in stock'], ['1', 'reserved'], ['0', 'picked up']] : [['5', 'na stanju'], ['1', 'rezervisano'], ['0', 'preuzeto']]}
            />
            <div className="push-end">
              <NextButton onClick={next} tone="ghost">
                {en ? 'Next: customer arrives' : 'Dalje: kupac dolazi'}
              </NextButton>
            </div>
          </>
        ),
      }),
    },
    {
      title: en ? 'Ana arrives at the shop' : 'Ana stiže u lokal',
      time: '19:42',
      actor: 'both',
      body: en
        ? 'During the pickup window, when Ana is within 50 m of the shop with an open reservation, the app confirms arrival. A badge appears at the counter showing the customer is there.'
        : 'U terminu preuzimanja, kad je Ana do 50 m od lokala sa otvorenom rezervacijom, aplikacija potvrdi dolazak. Na kasi se pojavi oznaka da je kupac tu.',
      points: en
        ? ['Location is only sent while the customer is near the shop', 'If the code isn’t scanned then, the Foodnesi team gets a warning', 'The counter screen keeps the tablet awake and plays a sound']
        : [
            'Lokacija se šalje samo kad je kupac blizu lokala',
            'Ako se kod tada ne skenira, tim Foodnesi dobija upozorenje',
            'Ekran za kasu drži tablet upaljen i pušta zvuk',
          ],
      customer: () => ({ nav: 2, content: <Reservation price={price} banner={en ? 'You’ve arrived at the shop. Show the code at the counter.' : 'Stigla si u lokal. Pokaži kod na kasi.'} /> }),
      partner: (next) => ({
        nav: 1,
        content: (
          <>
            <span className="a-h">{en ? 'Counter screen' : 'Ekran za kasu'}</span>
            <span className="a-sub">{en ? `${shop} · today` : `${shop} · danas`}</span>
            <div className="card pad order stack">
              <div className="row">
                <b className="grow" style={{ fontSize: 15 }}>
                  Ana M.
                </b>
                <span className="badge ok">{en ? 'Customer has arrived' : 'Kupac je stigao'}</span>
              </div>
              <span className="code" style={{ fontSize: 22 }}>
                FN-4F7K
              </span>
              <span className="a-sub">{en ? `1 × Surprise bag – pastries · ${price}` : `1 × Kesa iznenađenja – pecivo · ${price}`}</span>
            </div>
            <div className="card pad order idle stack">
              <b>Marko P.</b>
              <span className="a-sub">{en ? `2 bags · FN-9QX2 · ${d.money(2 * d.bagPrice)}` : `2 kese · FN-9QX2 · ${d.money(2 * d.bagPrice)}`}</span>
            </div>
            <div className="push-end">
              <NextButton onClick={next}>{en ? 'Scan code' : 'Skeniraj kod'}</NextButton>
            </div>
          </>
        ),
      }),
    },
    {
      title: en ? 'Scanning at the counter' : 'Skeniranje na kasi',
      time: '19:43',
      actor: 'partner',
      body: en
        ? 'The staff member points the camera at Ana’s phone. The scanner immediately says whether the code is valid and how much to charge.'
        : 'Zaposleni uperi kameru u Anin telefon. Skener odmah kaže da li je kod važeći i koliko treba naplatiti.',
      points: en
        ? ['Rejects early, expired, cancelled and already-picked-up codes', 'The code can also be typed in manually', 'Staff only see the scanner, orders and the counter screen']
        : [
            'Odbija prerane, istekle, otkazane i već preuzete kodove',
            'Kod se može i upisati ručno',
            'Zaposleni vide samo skener, narudžbine i ekran za kasu',
          ],
      customer: () => ({
        nav: 2,
        content: (
          <>
            <span className="a-h center">{en ? 'Show at the counter' : 'Pokaži na kasi'}</span>
            <div className="card pad stack center" style={{ flex: 1, alignContent: 'center', gap: 10 }}>
              <DemoQr className="big" />
              <div className="code" style={{ fontSize: 26 }}>
                FN-4F7K
              </div>
              <span className="a-sub">{en ? 'Screen brightness is boosted' : 'Osvetljenje ekrana je pojačano'}</span>
            </div>
          </>
        ),
      }),
      partner: (next) => ({
        nav: 3,
        content: (
          <>
            <span className="a-h">{en ? 'Scan' : 'Skeniraj'}</span>
            <div className="cam">
              <div className="frame" />
              <DemoQr />
              <div className="scan" />
            </div>
            <div className="card pad result stack" style={{ gap: 4 }}>
              <span className="big">{en ? 'Valid code' : 'Važeći kod'}</span>
              <span>
                {en ? (
                  <>
                    Hand over <b>1 bag</b> · Ana M.
                  </>
                ) : (
                  <>
                    Izdaj <b>1 kesu</b> · Ana M.
                  </>
                )}
              </span>
              <span>
                {en ? 'Charge' : 'Naplati'} <b>{price}</b>
              </span>
            </div>
            <NextButton onClick={next}>{en ? 'Handed over' : 'Izdato'}</NextButton>
          </>
        ),
      }),
    },
    {
      title: en ? 'Picked up' : 'Preuzeto',
      time: '19:43',
      actor: 'both',
      body: en
        ? 'The reservation is marked as picked up and paid. Ana’s screen refreshes itself in a few seconds, with no tap needed.'
        : 'Rezervacija je označena kao preuzeta i plaćena. Anin ekran se sam osveži za nekoliko sekundi, bez ikakvog dodira.',
      points: en
        ? ['+10 points per bag saved', 'The bag counts toward Ana’s impact: bags, savings, CO₂', 'The partner sees pickups and stock in Sales']
        : ['+10 bodova po spašenoj kesi', 'Kesa se računa u Anin uticaj: kese, ušteda, CO₂', 'Partner u Prodaji vidi preuzeto i stanje'],
      customer: (next) => ({
        nav: 2,
        content: (
          <>
            <div className="row">
              <span className="a-h grow">{en ? 'Reservation' : 'Rezervacija'}</span>
              <span className="badge ok">{en ? 'Picked up ✓' : 'Preuzeto ✓'}</span>
            </div>
            <div className="card pad stack center" style={{ padding: '20px 12px' }}>
              <div style={{ fontSize: 40, lineHeight: 1 }}>🥐</div>
              <b style={{ fontSize: 16 }}>{en ? 'Enjoy, Ana!' : 'Prijatno, Ana!'}</b>
              <span className="a-sub">{en ? `You saved a bag of food and ${d.money(d.bagValue - d.bagPrice)}.` : `Spasila si kesu hrane i uštedela ${d.money(d.bagValue - d.bagPrice)}.`}</span>
              <span className="badge orange" style={{ margin: '4px auto 0' }}>
                {en ? '+10 points' : '+10 bodova'}
              </span>
            </div>
            <div className="card pad">
              <Kv label={en ? 'Picked up' : 'Preuzeto'}>19:43</Kv>
              <Kv label={en ? 'Paid at the counter' : 'Plaćeno na kasi'}>{price}</Kv>
            </div>
            <div className="push-end">
              <NextButton onClick={next} tone="orange">
                {en ? 'Rate the bag' : 'Oceni kesu'}
              </NextButton>
            </div>
          </>
        ),
      }),
      partner: () => ({
        nav: 1,
        content: (
          <>
            <span className="a-h">{en ? 'Orders' : 'Narudžbine'}</span>
            <div className="card pad order done stack" style={{ gap: 4 }}>
              <div className="row">
                <b className="grow">Ana M.</b>
                <span className="badge ok">{en ? 'Handed over' : 'Izdato'}</span>
              </div>
              <span className="a-sub">FN-4F7K · QR · 19:43</span>
            </div>
            <div className="card pad order stack" style={{ gap: 4 }}>
              <b>Marko P.</b>
              <span className="a-sub">{en ? '2 bags · FN-9QX2 · waiting' : '2 kese · FN-9QX2 · čeka'}</span>
            </div>
            <span className="a-h" style={{ fontSize: 14, marginTop: 6 }}>
              {en ? 'Sales today' : 'Prodaja danas'}
            </span>
            <Stats items={en ? [['6', 'published'], ['5', 'sold'], ['1', 'picked up']] : [['6', 'objavljeno'], ['5', 'prodato'], ['1', 'preuzeto']]} />
          </>
        ),
      }),
    },
    {
      title: en ? 'Rating, points and the statement' : 'Ocena, bodovi i obračun',
      time: en ? 'later' : 'kasnije',
      actor: 'both',
      body: en
        ? 'Ana rates the bag and adds a photo, which future customers will see. At the end of the month the bakery gets its commission statement.'
        : 'Ana ocenjuje kesu i dodaje sliku, koju će videti sledeći kupci. Pekara na kraju meseca dobija obračun provizije.',
      points: en
        ? ['Levels: Beginner, Saver, Food Hero, Legend', 'Weekly challenge: 3 bags = double points', 'Ratings and photos build trust in the shop']
        : ['Nivoi: Početnik, Spasilac, Heroj hrane, Legenda', 'Izazov nedelje: 3 kese = dupli bodovi', 'Ocene i slike grade poverenje u lokal'],
      customer: () => ({
        nav: 4,
        content: (
          <>
            <span className="a-h">{en ? 'How was it?' : 'Kako je bilo?'}</span>
            <div className="card pad stack" style={{ gap: 8 }}>
              <span className="stars">★★★★★</span>
              <span>{en ? `"Two rolls, a burek and half a loaf. For ${price}, great!"` : `„Dve kifle, burek i pola vekne. Za ${price}, odlično!"`}</span>
              <div className="photo-row">
                <span />
                <span />
                <span className="add">+</span>
              </div>
            </div>
            <div className="card pad stack">
              <div className="row">
                <b className="grow">{en ? 'Level: Saver' : 'Nivo: Spasilac'}</b>
                <span className="a-sub end">{en ? '120 points' : '120 bodova'}</span>
              </div>
              <div className="lvl">
                <i style={{ width: '5%' }} />
              </div>
              <span className="a-sub">{en ? '380 more points to the “Food Hero” level' : 'Još 380 bodova do nivoa „Heroj hrane"'}</span>
            </div>
            <Stats
              items={
                en
                  ? [['12', 'bags saved'], [d.moneyWhole(12 * (d.bagValue - d.bagPrice)), 'saved'], ['32 kg', 'less CO₂e']]
                  : [['12', 'spašenih kesa'], [d.moneyWhole(12 * (d.bagValue - d.bagPrice)), 'ušteđeno'], ['32 kg', 'CO₂e manje']]
              }
            />
          </>
        ),
      }),
      partner: (restart) => ({
        nav: 0,
        content: (
          <>
            <span className="a-h">{en ? 'Statement · October' : 'Obračun · oktobar'}</span>
            <div className="card pad">
              <Kv label={en ? 'Bags picked up' : 'Preuzete kese'}>{month.bags}</Kv>
              <Kv label={en ? 'Charged at the counter' : 'Promet na kasi'}>{d.money(month.gross)}</Kv>
              <Kv label={en ? `Commission ${DEMO_COMMISSION_RATE * 100}%` : `Provizija ${DEMO_COMMISSION_RATE * 100}%`}>{d.money(month.commission)}</Kv>
              <Kv label={en ? 'Foodnesi discounts' : 'Popusti Foodnesi'}>−{d.money(month.discounts)}</Kv>
              <Kv label={en ? 'Boosted offers' : 'Istaknute ponude'}>+{d.money(month.boosts)}</Kv>
              <Kv label={en ? 'Owed' : 'Za uplatu'}>
                <span style={{ color: 'var(--basil)' }}>{d.money(month.total)}</span>
              </Kv>
            </div>
            <div className="card pad stack" style={{ gap: 2 }}>
              <div className="row">
                <b className="grow">{en ? 'Shop rating' : 'Ocena lokala'}</b>
                <span className="stars end" style={{ fontSize: 13 }}>
                  ★ 4.8
                </span>
              </div>
              <span className="a-sub">{en ? '86 reviews · new: Ana M., 5★ with a photo' : '86 ocena · nova: Ana M., 5★ sa slikom'}</span>
            </div>
            <button type="button" className="a-btn ghost" onClick={restart}>
              {en ? 'Restart the demo' : 'Pokreni demo ponovo'}
            </button>
          </>
        ),
      }),
    },
  ]
}
