import { Link } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'
import { LEGAL, legalHasPlaceholders } from '@/config/legal'
import { localize } from '@/i18n'

/**
 * Privacy policy and terms of use, in English (default: /privacy, /terms — the
 * links used in the app and the App Store) and Serbian (/privatnost, /uslovi).
 * Written to match what the app actually does (data, processors, retention) —
 * update both languages together with the code. Serbian texts go through
 * `localize` so they follow the Latin/Cyrillic setting.
 */
type Section = { title: string; text?: string[]; list?: string[] }

const company = `${LEGAL.company}, ${LEGAL.address}, matični broj ${LEGAL.registrationNumber}, PIB ${LEGAL.taxId}`

const PRIVACY_SR: Section[] = [
  {
    title: '1. Ko obrađuje tvoje podatke',
    text: [
      `Rukovalac podacima je ${company}. Za sva pitanja o privatnosti i za ostvarivanje svojih prava piši nam na ${LEGAL.privacyEmail}.`,
      'Ova politika važi za sajt i mobilnu aplikaciju Foodnesi i usklađena je sa Opštom uredbom EU o zaštiti podataka (GDPR) i Zakonom o zaštiti podataka o ličnosti Republike Srbije, kao i sa propisima drugih zemalja u kojima Foodnesi radi.',
    ],
  },
  {
    title: '2. Koje podatke prikupljamo',
    list: [
      'Nalog: ime, e-pošta, broj telefona, zemlja, lozinka (čuvamo samo šifrovani otisak, nikada samu lozinku) i profilna fotografija ako je dodaš.',
      'Rezervacije: šta si rezervisao/la, kada i u kom lokalu, iznos, kod za preuzimanje i status (preuzeto, otkazano, nepreuzeto), kao i tvoj odgovor na pitanje da li si preuzeo/la kesu.',
      'Ono što sam/a uneseš: ocene i komentare, poruke podršci, omiljene lokale i ponude, prijave na listu čekanja, promo kodove koje koristiš.',
      'Bodovi i pozivi: broj bodova, tvoj pozivni kod i informacija da li te je neko pozvao.',
      'Lokacija: kada dozvoliš, lokaciju uređaja koristimo da prikažemo ponude u blizini. Šalje se serveru samo uz pretragu i ne čuvamo je uz tvoj nalog; na uređaju se pamti poslednja izabrana lokacija.',
      'Potvrda dolaska: dok je rezervacija otvorena u aplikaciji u terminu preuzimanja, telefon proverava da li si u lokalu. Serveru se šalje samo kada si do oko 150 m od lokala, a uz rezervaciju čuvamo samo vreme dolaska i najmanju udaljenost (ne i tvoju putanju). Služi da se proveri da je preuzimanje zabeleženo.',
      'Dostava: ako naručiš dostavu, čuvamo adresu i tačku dostave; dok dostavljač vozi, njegov telefon šalje svoju lokaciju da bi je video/la na mapi, a ona se briše po predaji.',
      'Obaveštenja: ako uključiš obaveštenja na telefonu, čuvamo tehničku adresu uređaja za njihovo slanje.',
      'Tehnički podaci: IP adresa i podaci o zahtevima u serverskim zapisima, kratkotrajno, radi bezbednosti i otklanjanja grešaka.',
      'Za partnere i njihove zaposlene: podaci o firmi i lokalima, ponude, prodaja, mesečni obračuni i uplate, podaci iz prijave za partnera i nalozi zaposlenih.',
    ],
  },
  {
    title: '3. Zašto ih koristimo i na osnovu čega',
    list: [
      'Izvršenje ugovora (Uslovi korišćenja): nalog, rezervacije, izdavanje kese, potvrda rezervacije sa QR kodom, obaveštenja o rezervacijama, podrška.',
      'Legitimni interes: bezbednost i sprečavanje zloupotreba (npr. ograničenje pokušaja prijave, jedan nalog po broju telefona), provera da li su preuzimanja zabeležena (pitanje kupcu posle neskenirane rezervacije i statistika po lokalima), poboljšanje usluge.',
      'Saglasnost: obaveštenja na telefonu i lokacija uređaja. Saglasnost možeš povući u svakom trenutku u podešavanjima telefona ili u Profilu; to ne utiče na zakonitost ranije obrade.',
      'Zakonska obaveza: čuvanje podataka o obračunima i uplatama partnera prema propisima o računovodstvu i porezima.',
    ],
  },
  {
    title: '4. Ko vidi tvoje podatke',
    list: [
      'Lokal kod kog rezervišeš (partner i njegovi zaposleni) vidi tvoje ime, rezervaciju i kod za preuzimanje, da bi ti izdao kesu. Ne vidi tvoju e-poštu ni broj telefona.',
      'Uz ocenu se javno prikazuje samo tvoje ime i početno slovo prezimena.',
      'Ako podeliš link za preuzimanje, osoba koja ima link vidi kod i rezervaciju.',
      'Tim Foodnesi (podrška i administracija), samo u meri potrebnoj za posao.',
      'Pružaoci usluga koji podatke obrađuju po našem nalogu i uz ugovor o obradi: MongoDB Atlas (baza podataka, serveri u Frankfurtu, EU), Heroku/Salesforce (server aplikacije, region EU), Vercel (isporuka sajta), Cloudflare (čuvanje fotografija), MailerSend (slanje e-pošte), Apple, Google i Mozilla (dostava obaveštenja na uređaj), Mapbox ili OpenFreeMap (prikaz mape; servis vidi IP adresu kada se mapa učita) i OpenStreetMap Foundation (pretraga adrese pri unosu lokala).',
      'Državni organi, samo kada to zakon zahteva.',
    ],
    text: ['Tvoje podatke ne prodajemo i ne koristimo ih za reklame.'],
  },
  {
    title: '5. Prenos podataka van zemlje',
    text: [
      'Podatke čuvamo u Evropskoj uniji gde god je moguće. Neki pružaoci usluga su iz SAD; tada se prenos vrši na osnovu standardnih ugovornih klauzula EU ili okvira o privatnosti podataka EU–SAD, uz odgovarajuće mere zaštite.',
    ],
  },
  {
    title: '6. Koliko dugo čuvamo podatke',
    list: [
      'Nalog: dok ga ne obrišeš. Brisanjem naloga odmah se uklanjaju ime, e-pošta, telefon i fotografija, a brišu se omiljeni, lista čekanja, obaveštenja i uređaji za obaveštenja.',
      'Rezervacije ostaju bez tvojih ličnih podataka, jer su deo obračuna lokala, onoliko koliko zahtevaju računovodstveni propisi.',
      'Serverski zapisi: kratko, najviše 30 dana.',
      'Link za novu lozinku važi 60 minuta i može se iskoristiti jednom. Prijava na uređaju ističe posle 60 dana nekorišćenja.',
    ],
  },
  {
    title: '7. Kolačići i memorija uređaja',
    text: [
      'Ne koristimo kolačiće za praćenje, reklame ni alate za analitiku. U memoriji uređaja čuvamo samo ono što je neophodno da aplikacija radi: prijavu, izabranu lokaciju i zemlju, pismo (latinica/ćirilica) i podešavanja skenera. Zbog toga ne tražimo posebnu saglasnost za kolačiće.',
    ],
  },
  {
    title: '8. Tvoja prava',
    list: [
      'Pristup i prenosivost: u Profilu izaberi „Preuzmi moje podatke" i dobićeš sve podatke o sebi u jednom fajlu.',
      'Ispravka: ime, telefon i fotografiju menjaš u Profilu; za ostalo nam piši.',
      'Brisanje: u Profilu izaberi „Obriši nalog".',
      'Ograničenje obrade i prigovor na obradu zasnovanu na legitimnom interesu.',
      'Povlačenje saglasnosti (obaveštenja, lokacija) u svakom trenutku.',
      'Pritužba nadzornom organu: u Srbiji Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti (www.poverenik.rs), ili organu za zaštitu podataka u zemlji u kojoj živiš.',
    ],
    text: [`Zahteve šalji na ${LEGAL.privacyEmail}. Odgovaramo bez odlaganja, a najkasnije u roku od 30 dana.`],
  },
  {
    title: '9. Kako štitimo podatke',
    text: [
      'Sva komunikacija ide preko šifrovane veze (HTTPS), lozinke su zaštićene jednosmernim šifrovanjem, pristup podacima u timu je ograničen po ulogama, a administrativne radnje se beleže. Promena lozinke odjavljuje sve uređaje.',
    ],
  },
  {
    title: '10. Deca',
    text: ['Foodnesi je namenjen osobama od 16 i više godina. Ne prikupljamo svesno podatke mlađih osoba.'],
  },
  {
    title: '11. Izmene',
    text: ['O važnim izmenama ove politike obavestićemo te u aplikaciji ili e-poštom pre nego što stupe na snagu.'],
  },
]

const TERMS_SR: Section[] = [
  {
    title: '1. O usluzi',
    text: [
      `Foodnesi (u daljem tekstu: platforma) je usluga koju pruža ${company}. Platforma povezuje kupce sa lokalima (pekare, restorani, prodavnice…) koji prodaju višak hrane po sniženoj ceni.`,
      'Ugovor o kupovini kese sklapaš direktno sa lokalom; platforma posreduje u rezervaciji. Plaćanje se vrši u lokalu, pri preuzimanju.',
    ],
  },
  {
    title: '2. Nalog',
    list: [
      'Za rezervaciju je potreban nalog. Moraš imati najmanje 16 godina i uneti tačne podatke.',
      'Jedan broj telefona može biti povezan samo sa jednim nalogom.',
      'Čuvaj svoju lozinku; odgovoran/na si za radnje sa svog naloga. Nalog možeš obrisati u Profilu.',
    ],
  },
  {
    title: '3. Rezervacija i preuzimanje',
    list: [
      'Rezervacija te obavezuje da dođeš u navedenom vremenu preuzimanja i platiš cenu iz rezervacije.',
      'Na kasi pokaži QR kod ili kod za preuzimanje iz aplikacije ili iz mejla potvrde.',
      'Kesa iznenađenja ima promenljiv sadržaj; ako imaš alergije ili posebne potrebe, proveri sa lokalom pre preuzimanja.',
      'Rezervaciju možeš otkazati u aplikaciji najkasnije 30 minuta pre početka preuzimanja.',
      'Ako ne dođeš, rezervacija ističe. Posle toga te pitamo da li si preuzeo/la kesu; tvoj odgovor mora biti istinit. Ponovljeno nedolaženje ili lažne potvrde mogu dovesti do ograničenja naloga.',
    ],
  },
  {
    title: '4. Odgovornost lokala',
    text: [
      'Lokal je prodavac i odgovara za kvalitet i bezbednost hrane, tačnost opisa, alergene i cenu. Reklamaciju na hranu podnosiš lokalu; ako ne uspete da je rešite, piši nam i pomoći ćemo.',
    ],
  },
  {
    title: '5. Promo kodovi, bodovi i ocene',
    list: [
      'Promo kodovi i bodovi nemaju novčanu vrednost, ne mogu se zameniti za novac i mogu se menjati ili ukinuti.',
      'Ocene moraju biti zasnovane na stvarnom preuzimanju, istinite i bez uvredljivog sadržaja. Ocene koje krše ova pravila možemo ukloniti.',
    ],
  },
  {
    title: '6. Uslovi za partnere (lokale)',
    list: [
      'Partner objavljuje tačne ponude (sadržaj, cena, količina, vreme preuzimanja, alergeni) i poštuje ih.',
      'Svako izdavanje kese partner beleži skeniranjem QR koda ili unosom koda kupca. Preuzimanje koje je kupac potvrdio, a partner nije zabeležio, ulazi u obračun; partner ga može osporiti u roku od 14 dana, a o sporu odlučuje platforma.',
      'Partner plaća proviziju na preuzete kese prema ugovoru, jednom mesečno, na osnovu obračuna u portalu za partnere.',
      'Partner odgovara za svoje zaposlene kojima je dao pristup i podatke kupaca koristi samo za izdavanje rezervacija.',
      'Pri kršenju ovih uslova platforma može upozoriti, pauzirati ili blokirati partnerski nalog.',
    ],
  },
  {
    title: '7. Zabranjeno',
    text: [
      'Zabranjeno je zloupotrebljavati platformu: lažne rezervacije ili potvrde preuzimanja, više naloga radi zaobilaženja pravila, ometanje rada sistema i pristup tuđim nalozima.',
    ],
  },
  {
    title: '8. Odgovornost platforme',
    text: [
      'Trudimo se da platforma radi bez prekida, ali ne garantujemo stalnu dostupnost. U meri dozvoljenoj zakonom, platforma ne odgovara za hranu koju prodaje lokal niti za štetu nastalu nepoštovanjem ovih uslova. Ovo ne ograničava prava koja ti kao potrošaču pripadaju po zakonu.',
    ],
  },
  {
    title: '9. Merodavno pravo i prigovori',
    text: [
      `Na ove uslove primenjuje se pravo Republike Srbije, ne dirajući u obavezna prava potrošača prema propisima zemlje u kojoj živiš. Prigovore šalji na ${LEGAL.supportEmail} ili kroz „Pomoć i podrška" u aplikaciji; odgovaramo u roku od 8 dana.`,
    ],
  },
  {
    title: '10. Izmene uslova',
    text: ['O važnim izmenama obavestićemo te unapred u aplikaciji ili e-poštom. Nastavkom korišćenja posle stupanja izmena na snagu prihvataš nove uslove.'],
  },
]

const companyEn = `${LEGAL.company}, ${LEGAL.address}, company ID ${LEGAL.registrationNumber}, tax ID (PIB) ${LEGAL.taxId}`

const PRIVACY_EN: Section[] = [
  {
    title: '1. Who processes your data',
    text: [
      `The data controller is ${companyEn}. For any privacy question or to exercise your rights, write to ${LEGAL.privacyEmail}.`,
      'This policy applies to the Foodnesi website and mobile app. It follows the EU General Data Protection Regulation (GDPR), the Serbian Law on Personal Data Protection and the laws of the other countries where Foodnesi operates.',
    ],
  },
  {
    title: '2. What data we collect',
    list: [
      'Account: name, e-mail, phone number, country, password (we store only an encrypted hash, never the password itself) and a profile photo if you add one.',
      'Reservations: what you reserved, when and where, the amount, the pickup code and status (collected, cancelled, not collected), and your answer when we ask whether you picked up the bag.',
      'What you enter yourself: ratings and comments, messages to support, favourite places and offers, waitlist sign-ups, promo codes you use.',
      'Points and invitations: your points, your invite code and whether someone invited you.',
      'Location: if you allow it, we use your device location to show nearby offers. It is sent to the server only with a search and is not stored with your account; the device remembers your last chosen location.',
      'Arrival check: while a reservation is open in the app during the pickup window, your phone checks whether you are at the shop. It is sent to the server only when you are within about 150 m of the shop, and with the reservation we keep only the time of arrival and the closest distance (not your route). It is used to check that the pickup was recorded.',
      'Delivery: if you order a delivery, we keep the delivery address and point; while the courier is driving, their phone shares its location so you can see it on the map, and it is deleted after the hand-over.',
      'Notifications: if you turn on phone notifications, we store the technical address of your device used to deliver them.',
      'Technical data: IP address and request details in server logs, briefly, for security and troubleshooting.',
      'For partners and their staff: company and location details, offers, sales, monthly statements and payments, partner application details and staff accounts.',
    ],
  },
  {
    title: '3. Why we use it and on what legal basis',
    list: [
      'Performance of a contract (Terms of Use): account, reservations, handing over the bag, the reservation confirmation with the QR code, reservation notifications, support.',
      'Legitimate interest: security and abuse prevention (e.g. limiting sign-in attempts, one account per phone number), checking that pickups are recorded (asking the customer after an unscanned reservation, statistics per location), improving the service.',
      'Consent: phone notifications and device location. You can withdraw consent at any time in your phone settings or in your Profile; this does not affect processing before the withdrawal.',
      'Legal obligation: keeping partner statements and payments as required by accounting and tax laws.',
    ],
  },
  {
    title: '4. Who sees your data',
    list: [
      'The place where you reserve (the partner and its staff) sees your name, the reservation and the pickup code, so they can hand over the bag. They do not see your e-mail or phone number.',
      'Next to a rating, only your first name and the initial of your last name are shown publicly.',
      'If you share a pickup link, anyone with the link sees the code and the reservation.',
      'The Foodnesi team (support and administration), only as needed for their work.',
      'Service providers processing data on our behalf under a data processing agreement: MongoDB Atlas (database, servers in Frankfurt, EU), Heroku/Salesforce (application server, EU region), Vercel (website delivery), Cloudflare (photo storage), MailerSend (e-mail delivery), Apple, Google and Mozilla (delivering notifications to your device), Mapbox or OpenFreeMap (map display; it sees your IP address when the map loads) and the OpenStreetMap Foundation (address search when a partner adds a location).',
      'Public authorities, only when required by law.',
    ],
    text: ['We do not sell your data and do not use it for advertising.'],
  },
  {
    title: '5. Transfers outside your country',
    text: [
      'We keep data in the European Union wherever possible. Some providers are based in the United States; such transfers rely on the EU Standard Contractual Clauses or the EU–US Data Privacy Framework, with appropriate safeguards.',
    ],
  },
  {
    title: '6. How long we keep data',
    list: [
      'Account: until you delete it. Deleting your account immediately removes your name, e-mail, phone and photo, and deletes your favourites, waitlist, notifications and notification devices.',
      'Reservations remain without your personal data, because they are part of the partners\' statements, for as long as accounting laws require.',
      'Server logs: briefly, at most 30 days.',
      'A password reset link is valid for 60 minutes and can be used once. Sign-in on a device expires after 60 days of inactivity.',
    ],
  },
  {
    title: '7. Cookies and device storage',
    text: [
      'We do not use tracking cookies, advertising or analytics tools. On your device we store only what the app needs to work: your sign-in, chosen location and country, script (Latin/Cyrillic) and scanner settings. Therefore we do not ask for separate cookie consent.',
    ],
  },
  {
    title: '8. Your rights',
    list: [
      'Access and portability: in your Profile choose "Preuzmi moje podatke" (Download my data) to get all your data in one file.',
      'Rectification: change your name, phone and photo in your Profile; write to us for anything else.',
      'Erasure: in your Profile choose "Obriši nalog" (Delete account).',
      'Restriction of processing and objection to processing based on legitimate interest.',
      'Withdrawal of consent (notifications, location) at any time.',
      'Complaint to a supervisory authority: in Serbia the Commissioner for Information of Public Importance and Personal Data Protection (www.poverenik.rs), or the data protection authority in the country where you live.',
    ],
    text: [`Send requests to ${LEGAL.privacyEmail}. We reply without undue delay and at the latest within 30 days.`],
  },
  {
    title: '9. How we protect data',
    text: [
      'All communication uses an encrypted connection (HTTPS), passwords are protected with one-way encryption, team access is limited by role and administrative actions are logged. Changing your password signs out all devices.',
    ],
  },
  {
    title: '10. Children',
    text: ['Foodnesi is intended for people aged 16 and over. We do not knowingly collect data from younger people.'],
  },
  {
    title: '11. Changes',
    text: ['We will notify you of important changes to this policy in the app or by e-mail before they take effect.'],
  },
]

const TERMS_EN: Section[] = [
  {
    title: '1. About the service',
    text: [
      `Foodnesi (the "platform") is provided by ${companyEn}. The platform connects customers with food businesses (bakeries, restaurants, shops…) that sell surplus food at a reduced price.`,
      'The purchase contract for a bag is made directly with the business; the platform mediates the reservation. Payment is made at the business, on pickup.',
    ],
  },
  {
    title: '2. Account',
    list: [
      'You need an account to reserve. You must be at least 16 years old and provide accurate information.',
      'A phone number can be linked to only one account.',
      'Keep your password safe; you are responsible for actions taken with your account. You can delete your account in your Profile.',
    ],
  },
  {
    title: '3. Reservation and pickup',
    list: [
      'A reservation commits you to come within the stated pickup time and pay the price shown in the reservation.',
      'At the counter, show the QR code or the pickup code from the app or the confirmation e-mail.',
      'The contents of a surprise bag vary; if you have allergies or special needs, check with the business before pickup.',
      'You can cancel a reservation in the app up to 30 minutes before pickup starts.',
      'If you do not come, the reservation expires. We then ask whether you picked up the bag; your answer must be truthful. Repeated no-shows or false confirmations may lead to restrictions on your account.',
    ],
  },
  {
    title: '4. Responsibility of the business',
    text: [
      'The business is the seller and is responsible for the quality and safety of the food, the accuracy of the description, allergens and the price. Complaints about the food go to the business; if you cannot resolve it, write to us and we will help.',
    ],
  },
  {
    title: '5. Promo codes, points and ratings',
    list: [
      'Promo codes and points have no cash value, cannot be exchanged for money and may be changed or withdrawn.',
      'Ratings must be based on an actual pickup, be truthful and contain no offensive content. We may remove ratings that break these rules.',
    ],
  },
  {
    title: '6. Terms for partners (businesses)',
    list: [
      'Partners publish accurate offers (contents, price, quantity, pickup time, allergens) and honour them.',
      'Partners record every hand-over by scanning the customer\'s QR code or entering the customer\'s code. A pickup confirmed by the customer but not recorded by the partner is included in the statement; the partner may dispute it within 14 days and the platform decides.',
      'Partners pay a commission on collected bags as agreed in their contract, monthly, based on the statement in the partner portal.',
      'Partners are responsible for the staff they give access to and use customer data only to hand over reservations.',
      'If these terms are breached, the platform may warn, pause or block the partner account.',
    ],
  },
  {
    title: '7. Prohibited use',
    text: [
      'Misuse of the platform is prohibited, including fake reservations or pickup confirmations, multiple accounts to get around the rules, disrupting the system and accessing other people\'s accounts.',
    ],
  },
  {
    title: '8. Liability of the platform',
    text: [
      'We work to keep the platform available but do not guarantee uninterrupted service. To the extent permitted by law, the platform is not liable for food sold by a business or for damage caused by breach of these terms. This does not limit your statutory rights as a consumer.',
    ],
  },
  {
    title: '9. Governing law and complaints',
    text: [
      `These terms are governed by the law of the Republic of Serbia, without prejudice to the mandatory consumer rights of the country where you live. Send complaints to ${LEGAL.supportEmail} or via "Pomoć i podrška" (Help & support) in the app; we reply within 8 days.`,
    ],
  },
  {
    title: '10. Changes to these terms',
    text: ['We will notify you of important changes in advance in the app or by e-mail. By continuing to use the service after changes take effect, you accept the new terms.'],
  },
]

type Lang = 'en' | 'sr'
type Doc = 'privacy' | 'terms'

const DOCS: Record<Doc, Record<Lang, { title: string; intro: string; updated: string; sections: Section[]; path: string }>> = {
  privacy: {
    en: { title: 'Privacy Policy', intro: 'How Foodnesi collects, uses and protects your data.', updated: 'Last updated', sections: PRIVACY_EN, path: '/privacy' },
    sr: { title: 'Politika privatnosti', intro: 'Kako Foodnesi prikuplja, koristi i štiti tvoje podatke.', updated: 'Poslednja izmena', sections: PRIVACY_SR, path: '/privatnost' },
  },
  terms: {
    en: { title: 'Terms of Use', intro: 'Rules for using the Foodnesi platform, for customers and partners.', updated: 'Last updated', sections: TERMS_EN, path: '/terms' },
    sr: { title: 'Uslovi korišćenja', intro: 'Pravila korišćenja platforme Foodnesi za kupce i partnere.', updated: 'Poslednja izmena', sections: TERMS_SR, path: '/uslovi' },
  },
}

const PLACEHOLDER_NOTE: Record<Lang, string> = {
  en: 'Company details have not been filled in yet (fields in [brackets]).',
  sr: 'Podaci o firmi još nisu uneti (polja u [zagradama]) – popuni ih pre objavljivanja.',
}

const formatUpdated = (lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${LEGAL.updatedAt}T12:00:00`))

function LegalDocument({ doc, lang }: { doc: Doc; lang: Lang }) {
  const d = DOCS[doc][lang]
  // Serbian follows the Latin/Cyrillic setting; English is shown as written.
  const text = (s: string) => (lang === 'sr' ? localize(s) : s)
  const other = doc === 'privacy' ? 'terms' : 'privacy'
  return (
    <div className="mx-auto max-w-3xl" lang={lang === 'en' ? 'en' : undefined}>
      <div className="mb-2 flex justify-end">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm font-semibold" role="group" aria-label="Language / Jezik">
          {(['en', 'sr'] as const).map((l) => (
            <Link
              key={l}
              to={DOCS[doc][l].path}
              aria-current={l === lang ? 'page' : undefined}
              className={l === lang ? 'rounded-full bg-card px-3 py-1 shadow-sm' : 'rounded-full px-3 py-1 text-muted-foreground'}
            >
              {l === 'en' ? 'English' : 'Srpski'}
            </Link>
          ))}
        </div>
      </div>
      <PageHeader title={text(d.title)} subtitle={text(`${d.intro} ${d.updated}: ${formatUpdated(lang)}`)} />
      {legalHasPlaceholders && (
        <p role="note" className="mb-4 flex items-start gap-2 rounded-xl bg-accent/25 p-3 text-sm font-semibold">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {text(PLACEHOLDER_NOTE[lang])}
        </p>
      )}
      <Card className="space-y-6 p-5 sm:p-8">
        {d.sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-lg font-bold">{text(s.title)}</h2>
            {s.list && (
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {s.list.map((item) => (
                  <li key={item}>{text(item)}</li>
                ))}
              </ul>
            )}
            {s.text?.map((p) => (
              <p key={p} className="text-sm leading-relaxed">
                {text(p)}
              </p>
            ))}
          </section>
        ))}
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to={DOCS[other][lang].path} className="underline">
          {text(DOCS[other][lang].title)}
        </Link>
      </p>
    </div>
  )
}

/** /privacy (English, default) and /privatnost (Serbian). */
export function PrivacyPage({ lang = 'en' }: { lang?: Lang }) {
  return <LegalDocument doc="privacy" lang={lang} />
}

/** /terms (English, default) and /uslovi (Serbian). */
export function TermsPage({ lang = 'en' }: { lang?: Lang }) {
  return <LegalDocument doc="terms" lang={lang} />
}
