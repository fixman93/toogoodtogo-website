import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, CheckCircle2, FileSignature, Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LEGAL_PATHS } from '@/config/legal'
import { localize } from '@/i18n'

/**
 * /partner-uslovi (Serbian, default) and /partner-terms (English) — rules for
 * business partners, taken from the "foODnesi Pravni i operativni paket"
 * (verzija 2.0, 22. 10. 2026): Ugovor o korišćenju platforme, Prilog A, B i C,
 * pravila za reklamacije, mesečni izveštaj i faktura. The package is a
 * working draft ("pravna i poreska provera obavezna"), so the page says so in
 * both languages and every value in [brackets] is shown as "for review". Do
 * not add terms that are not in the documents; update the version in
 * config/legal.ts (both apps) on changes, and keep SR/EN content in sync.
 */

type Lang = 'sr' | 'en'

const VERSION_LABEL: Record<Lang, string> = {
  sr: 'Verzija 2.0 od 22. oktobra 2026.',
  en: 'Version 2.0 of October 22, 2026.',
}
const SUPPORT_EMAIL = 'civcicboris93@gmail.com'

type Block = { p: string } | { list: string[] } | { ol: string[] } | { table: [string, string][]; head?: [string, string] } | { note: string }
type Section = { id: string; title: string; kicker?: string; blocks: Block[] }

const SUMMARY_SR: string[] = [
  'Foodnesi je digitalna platforma koja povezuje kupce sa nezavisnim partnerima. Partner je prodavac hrane kupcu.',
  'Kupac rezerviše kesu u aplikaciji, preuzima je na lokaciji partnera i cenu hrane plaća direktno partneru, koji izdaje račun. Foodnesi ne prima cenu hrane, ne priprema, ne skladišti i ne dostavlja hranu u okviru ovog poslovnog modela.',
  'Partner odgovara za zakonitost ponude, poreklo, ispravnost i bezbednost hrane, skladištenje, higijenu, rokove, alergene i druge obavezne informacije.',
  'Preuzimanje se evidentira skeniranjem QR koda kupca ili odobrenim rezervnim postupkom. QR evidencija je primarni zapis o preuzimanju; GPS je samo dopunski signal.',
  'Provizija se duguje samo za rezervacije koje su stvarno preuzete i za koje je partner naplatio cenu hrane. Stopa, osnovica, valuta i rok plaćanja određuju se u Prilogu A.',
  'Reklamacije na hranu rešava partner; tehničke probleme, netačnu evidenciju i sadržaj na platformi prijavljujete Foodnesi timu.',
]

const SUMMARY_EN: string[] = [
  'Foodnesi is a digital platform that connects customers with independent partners. The partner is the one selling food to the customer.',
  'The customer reserves a bag in the app, picks it up at the partner’s location, and pays for the food directly to the partner, who issues the receipt. Foodnesi does not receive the price of the food, and does not prepare, store or deliver food as part of this business model.',
  'The partner is responsible for the lawfulness of the offer, the origin, correctness and safety of the food, its storage, hygiene, best-by dates, allergens and other mandatory information.',
  'Pickup is recorded by scanning the customer’s QR code or through an approved fallback procedure. The QR record is the primary record of pickup; GPS is only a supplementary signal.',
  'Commission is owed only for reservations that were actually picked up and for which the partner charged the price of the food. The rate, basis, currency and payment deadline are set out in Annex A.',
  'Food-related complaints are handled by the partner; technical problems, incorrect records and platform content are reported to the Foodnesi team.',
]

const SECTIONS_SR: Section[] = [
  {
    id: 'dokumenti',
    title: 'Koji dokumenti važe i kada',
    blocks: [
      { p: 'Nisu svi dokumenti za potpis: deo partner potpisuje, deo izričito prihvata, a deo se koristi za obračun i evidenciju.' },
      {
        head: ['Dokument', 'Ko ga prihvata / potpisuje · kada'],
        table: [
          ['Ugovor o korišćenju platforme sa partnerom', 'Foodnesi (FIXMAN) i partner · pre aktivacije partnera'],
          ['Prilog A – komercijalni uslovi i provizija', 'Obe strane · uz ugovor (procenat, valuta, rok plaćanja)'],
          ['Prilog B – pristupni obrazac i izjava partnera', 'Partner / ovlašćeno lice · pre objave ponuda'],
          ['Prilog C – operativna pravila za partnere (ponude, preuzimanje, reklamacije)', 'Partner potpisuje ili izričito prihvata kao prilog · pre aktivacije'],
          ['Mesečni izveštaj preuzetih kesa i faktura za proviziju', 'Izveštaj dostavlja operater, fakturu izdaje FIXMAN · svakog meseca za prethodni mesec'],
        ],
      },
      { p: 'Ako tehnička obrada podataka to zahteva, potpisuje se i ugovor o obradi podataka (DPA). To nije automatski obavezan potpis sa svakim partnerom; zavisi od toga ko određuje svrhu i sredstva obrade.' },
    ],
  },
  {
    id: 'operater',
    title: 'Operater platforme',
    blocks: [
      {
        table: [
          ['Operater', 'FIXMAN, IT storitve in poslovno svetovanje, d.o.o.'],
          ['Sedište', 'Ulica Vita Kraigherja 5, 2000 Maribor, Slovenija'],
          ['Matični broj', '7378289000'],
          ['Davčni broj', '45280223'],
          ['Kontakt', SUPPORT_EMAIL],
        ],
      },
      { note: 'Podatke o operateru proveriti pre konačne objave.' },
    ],
  },
  {
    id: 'ugovor',
    title: 'Ugovor o korišćenju Foodnesi platforme',
    kicker: 'Potpisuju Operater i Partner (van aplikacije)',
    blocks: [
      { p: 'Ugovor zaključuju FIXMAN, IT storitve in poslovno svetovanje, d.o.o., kao operater platforme Foodnesi (Operater), i partner sa svojim registrovanim nazivom, sedištem, matičnim brojem, PIB-om i zastupnikom (Partner).' },
      { p: 'Član 1 – Predmet ugovora. Operater omogućava Partneru da na platformi Foodnesi objavljuje ponude kesa/paketa iznenađenja i prima rezervacije kupaca. Partner koristi platformu u skladu sa ovim ugovorom, komercijalnim prilogom i pravilima platforme.' },
      { p: 'Član 2 – Uloga Operatera i Partnera. Foodnesi je digitalna platforma koja povezuje kupce sa nezavisnim partnerima. Partner je prodavac hrane kupcu. Kupovina, plaćanje, predaja hrane i izdavanje računa kupcu odvijaju se između Partnera i kupca. Operater ne prima cenu hrane od kupca, ne priprema, ne skladišti i ne dostavlja hranu u okviru ovog poslovnog modela.' },
      { p: 'Ova podela uloga ne isključuje odgovornost koju bilo koja strana ima po obaveznim propisima. Operater ne može ugovorom isključiti zakonske obaveze koje mu eventualno pripadaju kao operatoru platforme.' },
      { p: 'Član 3 – Izjave i obaveze Partnera:' },
      {
        list: [
          'Partner potvrđuje da je uredno registrovan i da ima dozvole, registracije i uslove potrebne za obavljanje svoje delatnosti.',
          'Partner je odgovoran za zakonitost ponude, poreklo, ispravnost i bezbednost hrane, skladištenje, higijenu, rokove, alergene i druge obavezne informacije.',
          'Partner objavljuje tačan opis, cenu, broj raspoloživih kesa, lokaciju i vreme preuzimanja; ponuda mora odgovarati onome što kupac može razumno da očekuje iz opisa.',
          'Partner obezbeđuje da lice koje preuzima kesu može da proveri rezervaciju i da se preuzimanje evidentira QR kodom ili odobrenim rezervnim postupkom.',
          'Partner naplaćuje cenu hrane direktno kupcu i izdaje račun u skladu sa propisima koji se na njega primenjuju.',
          'Partner odmah obaveštava Operatera o incidentu u vezi sa bezbednošću hrane, povlačenju proizvoda, zabrani rada ili promeni podataka.',
        ],
      },
      { p: 'Član 4 – Rezervacije i preuzimanje. Rezervacija prikazuje cenu, lokaciju, vremenski prozor preuzimanja i osnovne informacije o ponudi. Partner se obavezuje da rezervisanu kesu čuva do isteka prikazanog roka, osim ako nastupi opravdan razlog i o tome odmah obavesti kupca i Operatera.' },
      { p: 'Po dolasku kupca Partner skenira QR kod ili koristi rezervni postupak koji je obezbedio Operater. QR evidencija je primarni zapis o preuzimanju. GPS ili drugi tehnički signal može biti samo dopunski signal za proveru i sam po sebi nije konačan dokaz da je hrana preuzeta ili plaćena.' },
      { p: 'Član 5 – Provizija i obračun. Partner duguje Operateru proviziju samo za rezervacije koje su stvarno preuzete i za koje je Partner naplatio cenu hrane. Stopa provizije, osnovica, valuta, poreski tretman i rok plaćanja definisani su u Prilogu A – Komercijalni uslovi.' },
      { p: 'Operater priprema mesečni izveštaj za prethodni kalendarski mesec i izdaje fakturu za proviziju na osnovu evidencije preuzetih kesa. Partner je dužan da proveri izveštaj i u roku od [5] radnih dana prijavi konkretne stavke koje osporava. Nesporni iznos plaća u roku od [15] dana od datuma fakture, osim ako Prilog A odredi drugačije.' },
      { p: 'Ako se nakon fakturisanja utvrdi greška, strane je ispravljaju dokumentovanom korekcijom i, kada je potrebno, odgovarajućim knjigovodstvenim dokumentom. Ne sme se obračunavati provizija za rezervaciju koja nije preuzeta ili za koju Partner nije primio plaćanje.' },
      { p: 'Član 6 – Podaci i poverljivost. Svaka strana koristi lične podatke samo za određene i zakonite svrhe, ograničava pristup na ovlašćena lica i primenjuje odgovarajuće mere zaštite. Strane će, pre početka obrade, utvrditi svoje uloge u skladu sa stvarnim načinom rada. Ako je potrebna obrada po nalogu, zaključiće poseban ugovor o obradi podataka.' },
      { p: 'Član 7 – Sadržaj, brend i dostupnost. Partner daje Operateru ograničeno, neisključivo pravo da tokom trajanja ugovora prikazuje naziv, logo, fotografije i opis Partnera isključivo radi predstavljanja ponuda na Foodnesi platformi i promocije platforme. Partner garantuje da ima pravo da dostavi taj materijal.' },
      { p: 'Operater može privremeno ograničiti pristup u slučaju sumnje na nezakonitu ponudu, bezbednosni incident, zloupotrebu, neplaćanje dospelih faktura ili povredu ugovora. Kada je razumno moguće, Partneru će biti dato obaveštenje i prilika da otkloni problem.' },
      { p: 'Član 8 – Trajanje i raskid. Ugovor stupa na snagu danom potpisivanja i zaključuje se na neodređeno vreme, osim ako strane ne upišu drugačije. Svaka strana može raskinuti ugovor uz otkazni rok od [30] dana. U slučaju ozbiljne povrede, rizika po bezbednost hrane, prevare ili nezakonite aktivnosti, Operater može odmah privremeno obustaviti ponude, uz naknadno obrazloženje u razumnom roku.' },
      { p: 'Raskid ne ukida obavezu plaćanja već nastale provizije, rešavanja spornih stavki, čuvanja dokumentacije prema propisima niti obaveze koje po svojoj prirodi ostaju na snazi.' },
      { p: 'Član 9 – Odgovornost i reklamacije. Partner vodi i rešava reklamacije koje se odnose na hranu, količinu, sastav, alergene, bezbednost hrane, cenu hrane i fiskalni račun, bez ograničavanja obaveznih prava kupca. Operater prima prijave tehničkih problema, netačne evidencije ili sadržaja na platformi i prosleđuje ih nadležnoj strani kada je potrebno.' },
      { p: 'Nijedna odredba ovog ugovora ne isključuje odgovornost koja se po zakonu ne može isključiti. Podela odgovornosti mora biti prikazana jasno i kupcima, a ne samo u ovom ugovoru.' },
      { p: 'Član 10 – Završne odredbe. Izmene ugovora moraju biti u pisanoj formi ili u obliku elektronski prihvaćenog dodatka koji omogućava dokaz o prihvatanju. Merodavno pravo, sudska nadležnost i eventualni postupak mirnog rešavanja spora biće [finalizovani nakon pravne provere u Srbiji i Sloveniji].' },
      { p: 'Potpisivanjem strane potvrđuju da su pročitale ugovor i priloge, da razumeju opisani model i da su ovlašćene da preuzmu ugovorne obaveze.' },
    ],
  },
  {
    id: 'prilog-a',
    title: 'Prilog A – Komercijalni uslovi i provizija',
    kicker: 'Sastavni deo ugovora · potpisuju obe strane',
    blocks: [
      {
        head: ['Stavka', 'Dogovor'],
        table: [
          ['Provizija', '[____] % od [tačno definisati osnovicu]'],
          ['Osnovica', 'Samo kese koje su stvarno preuzete i plaćene Partneru'],
          ['Obračunski period', 'Kalendarski mesec'],
          ['Valuta fakturisanja', '[EUR / RSD – potvrditi sa računovođom]'],
          ['Datum izveštaja i fakture', 'Početak narednog meseca za prethodni mesec'],
          ['Rok plaćanja', '[15] dana od datuma fakture'],
          ['Račun za uplatu', 'Prema podacima navedenim na validnoj fakturi Operatera'],
          ['Prigovor na izveštaj', 'U roku od [5] radnih dana od prijema'],
          ['Poreski tretman', 'Prema važećim pravilima i [potvrdi računovođe]; ne pretpostavljati tretman PDV-a'],
        ],
      },
      { p: 'Partner ne plaća proviziju za rezervacije koje nisu preuzete ili za koje naplata kupcu nije izvršena. Sve korekcije moraju biti proverljive iz evidencije rezervacija, QR potvrda, otkazivanja i reklamacija.' },
      { note: 'Tačan procenat provizije i ostali komercijalni uslovi upisuju se u Prilog A koji se potpisuje sa svakim partnerom.' },
    ],
  },
  {
    id: 'prilog-b',
    title: 'Prilog B – Pristupni obrazac partnera',
    kicker: 'Popunjava i potpisuje ovlašćeno lice pre aktivacije naloga',
    blocks: [
      { p: 'Podaci koje obrazac sadrži:' },
      {
        list: [
          'Puni registrovani naziv i pravni oblik',
          'Adresa sedišta i adresa lokacije preuzimanja',
          'Matični broj i PIB',
          'Ime, prezime i funkcija ovlašćenog lica',
          'E-mail i telefon',
          'Kontakt za reklamacije kupaca',
          'Vrsta objekta / delatnost',
          'Potvrda registracije / dokument (priloženo: da/ne)',
          'Kontakt za obračun faktura',
        ],
      },
      { p: 'Izjava Partnera: „Potvrđujem da su podaci tačni, da imam pravo da zastupam Partnera, da je Partner upoznat sa ugovorom i pravilima Foodnesi platforme i da će objavljivati samo zakonite ponude. Razumem da Partner prodaje hranu direktno kupcu, naplaćuje cenu hrane i odgovara za bezbednost hrane, obavezne informacije i izdavanje računa.“' },
    ],
  },
  {
    id: 'prilog-c',
    title: 'Prilog C – Operativna pravila za partnere',
    kicker: 'Ova pravila partner prihvata u portalu za partnere',
    blocks: [
      {
        ol: [
          'Pre objave proverite da opis, cena, broj kesa i vreme preuzimanja odgovaraju stvarnom stanju.',
          'Objavite sve obavezne informacije koje se primenjuju na konkretnu hranu, uključujući alergene kada je potrebno. Ako sastav kese nije unapred poznat, opis mora jasno objasniti šta kupac može razumno da očekuje.',
          'Pripremite rezervisanu kesu za prikazani vremenski prozor i obezbedite da hrana bude čuvana na odgovarajući način.',
          'Pri preuzimanju skenirajte QR kod kupca. Ne označavajte kesu kao preuzetu ako nije predata.',
          'Ako QR skener ne radi, koristite odobreni rezervni postupak i unesite razlog. Nemojte samostalno označavati nepreuzete rezervacije kao preuzete.',
          'Cenu hrane naplatite direktno kupcu i izdajte odgovarajući račun.',
          'Reklamacije koje se tiču hrane obradite bez odlaganja i u skladu sa propisima. Obavestite Foodnesi o ozbiljnom incidentu ili sumnji na nebezbednu hranu.',
          'Proverite mesečni izveštaj. Prijavite konkretne greške u dogovorenom roku i sačuvajte evidenciju za proveru.',
          'Ne tražite od kupca nepotrebne lične podatke. Ne fotografišite lične dokumente i ne delite podatke o rezervacijama sa neovlašćenim licima.',
          'Obavestite Foodnesi ako se promene naziv, adresa, PIB, status registracije, kontakt ili ovlašćeno lice.',
        ],
      },
      { p: 'Partner potvrđuje da je pročitao i prihvatio ova operativna pravila kao prilog ugovoru.' },
    ],
  },
  {
    id: 'reklamacije',
    title: 'Reklamacije, otkazivanje i nepreuzimanje',
    blocks: [
      { p: 'Hrana i prodaja. Partner je kontakt za reklamacije koje se odnose na hranu, cenu, količinu, sastav, alergene, bezbednost i račun, jer partner prodaje hranu i prima uplatu. Foodnesi obezbeđuje jasan način da korisnik dođe do kontakta partnera i da prijavi problem sa platformom.' },
      { p: `Tehnički problem. Ako QR kod ne radi ili status rezervacije nije tačan, korisnik ili partner kontaktira podršku na ${SUPPORT_EMAIL} i navodi identifikator rezervacije, vreme i kratak opis problema. Ne slati više ličnih podataka nego što je potrebno.` },
      { p: 'Otkazivanje i nedolazak. Pre potvrde rezervacije jasno se prikazuju rok preuzimanja i uslovi otkazivanja. Kod nedolaska sistem evidentira status, a korisniku omogućava da ospori grešku. Eventualna upozorenja ili ograničenja moraju biti proporcionalna, unapred objavljena i primenjivana dosledno. Automatska kazna se ne naplaćuje bez pravne provere.' },
      { p: 'Evidencija. Čuva se trag o QR skeniranju, rezervnom postupku, otkazivanju, prigovoru i korekciji statusa. Pristup evidenciji ograničen je na ovlašćena lica, a rok čuvanja je [potrebno definisati].' },
    ],
  },
  {
    id: 'obracun',
    title: 'Mesečni izveštaj i faktura za proviziju',
    blocks: [
      { p: 'Izveštaj se pravi za prethodni kalendarski mesec i šalje partneru uz fakturu ili pre nje. U njemu se prikazuju samo stavke koje ispunjavaju ugovoreni uslov za proviziju.' },
      {
        list: [
          'Operater, partner, obračunski period i broj fakture',
          'Broj preuzetih i plaćenih kesa',
          'Ukupna vrednost prodatih kesa prema evidenciji',
          'Stopa provizije, osnovica za proviziju i provizija pre poreza',
          'Poreski tretman [prema potvrdi računovođe i važećim pravilima]',
          'Ukupno za uplatu',
          'Napomena / korekcije (stavke i razlog)',
        ],
      },
      { p: 'Izveštaj je proverljiv po identifikatoru rezervacije, datumu preuzimanja, lokaciji partnera i statusu, i ne sadrži nepotrebne lične podatke kupaca.' },
      { p: 'Fakturu izdaje FIXMAN, IT storitve in poslovno svetovanje, d.o.o., sa opisom usluge „Provizija za usluge platforme Foodnesi za preuzete i plaćene kese u periodu [mesec/godina]“. Mesečni izveštaj o preuzetim kesama je prilog fakturi. Podaci za plaćanje navode se na fakturi.' },
      { note: 'Izgled fakture je predložak: obavezna polja, numeraciju, valutu, PDV/VAT formulaciju i mesto prometa usluge mora potvrditi računovođa pre prvog izdavanja.' },
    ],
  },
  {
    id: 'podaci',
    title: 'Podaci o ličnosti',
    blocks: [
      { p: 'Svaka strana koristi lične podatke samo za određene i zakonite svrhe, ograničava pristup na ovlašćena lica i primenjuje odgovarajuće mere zaštite (ugovor, član 6). Partner ne traži od kupca nepotrebne lične podatke i ne deli podatke o rezervacijama sa neovlašćenim licima (Prilog C, tačka 9).' },
      { p: 'Dodatak o obradi podataka (DPA) koristi se samo ako jedna strana obrađuje lične podatke u ime druge strane, prema dokumentovanoj instrukciji. Ako su obe strane nezavisni rukovaoci, razmena podataka i odgovornosti opisuju se na drugi odgovarajući način. [Uloge strana se utvrđuju prema stvarnom toku podataka.]' },
    ],
  },
]

const SECTIONS_EN: Section[] = [
  {
    id: 'documents',
    title: 'Which documents apply, and when',
    blocks: [
      { p: 'Not every document is signed: some are signed by the partner, some are expressly accepted, and some are used for accounting and record-keeping.' },
      {
        head: ['Document', 'Who accepts / signs it · when'],
        table: [
          ['Platform usage agreement with the partner', 'Foodnesi (FIXMAN) and the partner · before partner activation'],
          ['Annex A – commercial terms and commission', 'Both parties · together with the agreement (percentage, currency, payment deadline)'],
          ['Annex B – partner onboarding form and statement', 'Partner / authorized person · before publishing offers'],
          ['Annex C – partner operating rules (offers, pickup, complaints)', 'Partner signs or expressly accepts as an annex · before activation'],
          ['Monthly report of picked-up bags and the commission invoice', 'Report provided by the operator, invoice issued by FIXMAN · every month, for the previous month'],
        ],
      },
      { p: 'If the technical processing of data requires it, a data processing agreement (DPA) is also signed. This isn’t automatically mandatory with every partner; it depends on who determines the purpose and means of processing.' },
    ],
  },
  {
    id: 'operator',
    title: 'Platform operator',
    blocks: [
      {
        table: [
          ['Operator', 'FIXMAN, IT storitve in poslovno svetovanje, d.o.o.'],
          ['Registered seat', 'Ulica Vita Kraigherja 5, 2000 Maribor, Slovenia'],
          ['Registration number', '7378289000'],
          ['Tax number', '45280223'],
          ['Contact', SUPPORT_EMAIL],
        ],
      },
      { note: 'Operator details should be verified before final publication.' },
    ],
  },
  {
    id: 'agreement',
    title: 'Foodnesi platform usage agreement',
    kicker: 'Signed by the Operator and the Partner (outside the app)',
    blocks: [
      { p: 'The agreement is entered into by FIXMAN, IT storitve in poslovno svetovanje, d.o.o., as the operator of the Foodnesi platform (Operator), and the partner with its registered name, registered seat, registration number, tax ID and representative (Partner).' },
      { p: 'Article 1 – Subject of the agreement. The Operator enables the Partner to publish surprise bag/package offers on the Foodnesi platform and to receive customer reservations. The Partner uses the platform in accordance with this agreement, the commercial annex and the platform rules.' },
      { p: 'Article 2 – Role of the Operator and the Partner. Foodnesi is a digital platform that connects customers with independent partners. The Partner is the one selling food to the customer. The purchase, payment, handover of food and issuing of a receipt to the customer take place between the Partner and the customer. The Operator does not receive the price of the food from the customer, and does not prepare, store or deliver food as part of this business model.' },
      { p: 'This division of roles does not exclude liability that either party has under mandatory regulations. The Operator cannot contractually exclude statutory obligations that may apply to it as a platform operator.' },
      { p: 'Article 3 – Partner’s representations and obligations:' },
      {
        list: [
          'The Partner confirms it is duly registered and holds the permits, registrations and conditions required to carry out its activity.',
          'The Partner is responsible for the lawfulness of the offer, the origin, correctness and safety of the food, its storage, hygiene, best-by dates, allergens and other mandatory information.',
          'The Partner publishes an accurate description, price, number of available bags, location and pickup time; the offer must match what a customer can reasonably expect from the description.',
          'The Partner ensures that the person picking up the bag can be verified against the reservation and that pickup is recorded by QR code or an approved fallback procedure.',
          'The Partner charges the price of the food directly to the customer and issues a receipt in accordance with the regulations that apply to it.',
          'The Partner immediately notifies the Operator of any incident related to food safety, a product recall, a ban on operating, or a change of its details.',
        ],
      },
      { p: 'Article 4 – Reservations and pickup. A reservation shows the price, location, pickup time window and basic information about the offer. The Partner undertakes to hold the reserved bag until the shown deadline expires, unless a justified reason arises and the customer and the Operator are notified immediately.' },
      { p: 'When the customer arrives, the Partner scans the QR code or uses the fallback procedure provided by the Operator. The QR record is the primary record of pickup. GPS or another technical signal may only be a supplementary signal for verification and is not, by itself, conclusive proof that the food was picked up or paid for.' },
      { p: 'Article 5 – Commission and settlement. The Partner owes the Operator commission only for reservations that were actually picked up and for which the Partner charged the price of the food. The commission rate, basis, currency, tax treatment and payment deadline are defined in Annex A – Commercial Terms.' },
      { p: 'The Operator prepares a monthly report for the previous calendar month and issues a commission invoice based on the record of picked-up bags. The Partner must review the report and report specific disputed items within [5] business days. The undisputed amount is paid within [15] days of the invoice date, unless Annex A provides otherwise.' },
      { p: 'If an error is found after invoicing, the parties correct it with a documented adjustment and, where necessary, an appropriate accounting document. Commission must not be charged for a reservation that wasn’t picked up or for which the Partner did not receive payment.' },
      { p: 'Article 6 – Data and confidentiality. Each party uses personal data only for specified and lawful purposes, limits access to authorized persons, and applies appropriate protection measures. The parties will determine their roles before processing begins, in line with how the processing actually works. If processing on instruction is required, a separate data processing agreement will be signed.' },
      { p: 'Article 7 – Content, brand and availability. The Partner grants the Operator a limited, non-exclusive right to display the Partner’s name, logo, photos and description for the duration of the agreement, solely to present offers on the Foodnesi platform and to promote the platform. The Partner warrants that it has the right to provide that material.' },
      { p: 'The Operator may temporarily restrict access in case of suspected unlawful offers, a security incident, misuse, non-payment of due invoices, or breach of the agreement. Where reasonably possible, the Partner will be given notice and a chance to resolve the issue.' },
      { p: 'Article 8 – Term and termination. The agreement takes effect on the date of signing and is concluded for an indefinite period, unless the parties specify otherwise. Either party may terminate the agreement with [30] days’ notice. In case of a serious breach, a food safety risk, fraud or unlawful activity, the Operator may immediately suspend offers temporarily, with a subsequent explanation within a reasonable time.' },
      { p: 'Termination does not cancel the obligation to pay commission already accrued, to resolve disputed items, to keep records as required by regulations, or any obligation that by its nature survives termination.' },
      { p: 'Article 9 – Liability and complaints. The Partner handles and resolves complaints relating to the food, quantity, contents, allergens, food safety, the price of the food and the fiscal receipt, without limiting the customer’s mandatory rights. The Operator receives reports of technical problems, inaccurate records or platform content and forwards them to the responsible party where necessary.' },
      { p: 'No provision of this agreement excludes liability that cannot be excluded by law. The division of liability must be clearly shown to customers too, not only in this agreement.' },
      { p: 'Article 10 – Final provisions. Amendments to the agreement must be in writing or in the form of an electronically accepted addendum that allows proof of acceptance. The governing law, jurisdiction and any dispute-resolution procedure will be [finalized after legal review in Serbia and Slovenia].' },
      { p: 'By signing, the parties confirm that they have read the agreement and its annexes, understand the model described, and are authorized to assume the contractual obligations.' },
    ],
  },
  {
    id: 'annex-a',
    title: 'Annex A – Commercial terms and commission',
    kicker: 'An integral part of the agreement · signed by both parties',
    blocks: [
      {
        head: ['Item', 'Terms'],
        table: [
          ['Commission', '[____] % of [exact basis to be defined]'],
          ['Basis', 'Only bags that were actually picked up and paid to the Partner'],
          ['Billing period', 'Calendar month'],
          ['Invoicing currency', '[EUR / RSD – to confirm with an accountant]'],
          ['Report and invoice date', 'Start of the following month, for the previous month'],
          ['Payment deadline', '[15] days from the invoice date'],
          ['Payment account', 'As stated on the Operator’s valid invoice'],
          ['Objection to the report', 'Within [5] business days of receipt'],
          ['Tax treatment', 'Per applicable rules and [accountant confirmation]; do not assume VAT treatment'],
        ],
      },
      { p: 'The Partner does not pay commission for reservations that weren’t picked up or for which the customer wasn’t charged. All corrections must be verifiable from the reservation, QR confirmation, cancellation and complaint records.' },
      { note: 'The exact commission percentage and other commercial terms are entered in Annex A, which is signed with each partner.' },
    ],
  },
  {
    id: 'annex-b',
    title: 'Annex B – Partner onboarding form',
    kicker: 'Filled in and signed by an authorized person before account activation',
    blocks: [
      { p: 'Information collected by the form:' },
      {
        list: [
          'Full registered name and legal form',
          'Registered seat address and pickup location address',
          'Registration number and tax ID',
          'First name, last name and role of the authorized person',
          'Email and phone',
          'Contact for customer complaints',
          'Type of establishment / activity',
          'Proof of registration / document (attached: yes/no)',
          'Contact for invoicing',
        ],
      },
      { p: 'Partner’s statement: “I confirm that the information is accurate, that I am authorized to represent the Partner, that the Partner is aware of the agreement and the rules of the Foodnesi platform, and that it will only publish lawful offers. I understand that the Partner sells food directly to the customer, charges for the food, and is responsible for food safety, mandatory information, and issuing receipts.”' },
    ],
  },
  {
    id: 'annex-c',
    title: 'Annex C – Partner operating rules',
    kicker: 'The partner accepts these rules in the partner portal',
    blocks: [
      {
        ol: [
          'Before publishing, check that the description, price, number of bags and pickup time match the actual state.',
          'Publish all mandatory information that applies to the specific food, including allergens where required. If a bag’s contents aren’t known in advance, the description must clearly explain what a customer can reasonably expect.',
          'Prepare the reserved bag for the shown time window and ensure the food is stored appropriately.',
          'Scan the customer’s QR code on pickup. Don’t mark a bag as picked up if it wasn’t handed over.',
          'If the QR scanner doesn’t work, use the approved fallback procedure and enter the reason. Don’t mark unclaimed reservations as picked up on your own.',
          'Charge the price of the food directly to the customer and issue an appropriate receipt.',
          'Handle food-related complaints without delay and in accordance with regulations. Notify Foodnesi of a serious incident or suspected unsafe food.',
          'Check the monthly report. Report specific errors within the agreed deadline and keep records for verification.',
          'Don’t ask the customer for unnecessary personal data. Don’t photograph personal documents and don’t share reservation data with unauthorized persons.',
          'Notify Foodnesi if the name, address, tax ID, registration status, contact or authorized person changes.',
        ],
      },
      { p: 'The Partner confirms it has read and accepted these operating rules as an annex to the agreement.' },
    ],
  },
  {
    id: 'complaints',
    title: 'Complaints, cancellation and no-shows',
    blocks: [
      { p: 'Food and sale. The Partner is the contact for complaints relating to the food, price, quantity, contents, allergens, safety and receipt, because the Partner sells the food and receives payment. Foodnesi provides a clear way for the customer to reach the partner’s contact and to report a problem with the platform.' },
      { p: `Technical problem. If a QR code doesn’t work or a reservation’s status is incorrect, the customer or partner contacts support at ${SUPPORT_EMAIL} and provides the reservation identifier, the time, and a short description of the problem. Don’t send more personal data than necessary.` },
      { p: 'Cancellation and no-shows. The pickup deadline and cancellation terms are clearly shown before the reservation is confirmed. On a no-show, the system records the status and lets the customer dispute an error. Any warnings or restrictions must be proportionate, published in advance and applied consistently. An automatic penalty is not charged without legal review.' },
      { p: 'Records. A trail is kept of QR scans, the fallback procedure, cancellations, objections and status corrections. Access to records is limited to authorized persons, and the retention period is [to be defined].' },
    ],
  },
  {
    id: 'statement',
    title: 'Monthly report and commission invoice',
    blocks: [
      { p: 'The report is prepared for the previous calendar month and sent to the partner together with the invoice or before it. It shows only items that meet the agreed condition for commission.' },
      {
        list: [
          'Operator, partner, billing period and invoice number',
          'Number of bags picked up and paid for',
          'Total value of bags sold according to the records',
          'Commission rate, commission basis, and commission before tax',
          'Tax treatment [per accountant confirmation and applicable rules]',
          'Total due',
          'Note / corrections (items and reason)',
        ],
      },
      { p: 'The report is verifiable by reservation identifier, pickup date, partner location and status, and does not contain unnecessary personal data about customers.' },
      { p: 'The invoice is issued by FIXMAN, IT storitve in poslovno svetovanje, d.o.o., with the service description “Commission for Foodnesi platform services for bags picked up and paid for in the period [month/year]”. The monthly report of picked-up bags is attached to the invoice. Payment details are stated on the invoice.' },
      { note: 'The invoice layout is a template: mandatory fields, numbering, currency, the VAT wording and the place of supply of the service must be confirmed by an accountant before the first invoice is issued.' },
    ],
  },
  {
    id: 'personal-data',
    title: 'Personal data',
    blocks: [
      { p: 'Each party uses personal data only for specified and lawful purposes, limits access to authorized persons, and applies appropriate protection measures (agreement, Article 6). The Partner does not ask customers for unnecessary personal data and does not share reservation data with unauthorized persons (Annex C, item 9).' },
      { p: 'A data processing addendum (DPA) is used only if one party processes personal data on behalf of the other, under documented instructions. If both parties are independent controllers, the exchange of data and responsibilities is described in another appropriate way. [The parties’ roles are determined according to the actual flow of data.]' },
    ],
  },
]

/** "Before signing, be sure to complete and verify" (instructions and checklist accompanying the package). */
const OPEN_ITEMS_SR: string[] = [
  'Procenat provizije i da li se računa na bruto iznos naplaćen kupcu ili na drugi iznos.',
  'Valuta, rok plaćanja fakture, eventualni troškovi i pravila za ispravke.',
  'Poreski tretman usluge koju slovenačko društvo fakturiše partneru u Srbiji, uključujući PDV/VAT i eventualne obaveze registracije.',
  'Da li je za konkretan model potrebna registracija, fiskalizacija, lokalni zastupnik ili dodatna prijava u Srbiji.',
  'Podaci o zastupniku partnera, registraciji, adresi, PIB-u i kontaktu za reklamacije.',
  'Pravni osnov, tehnička implementacija i rok čuvanja GPS podataka; GPS ne sme biti jedini dokaz preuzimanja.',
  'Konačni uslovi za rezervaciju, nedolazak, otkazivanje i prigovore.',
  'Merodavno pravo, sudska nadležnost i postupak mirnog rešavanja spora (ugovor, član 10).',
  'Rokovi u zagradama: prigovor na izveštaj [5] radnih dana, plaćanje [15] dana, otkazni rok [30] dana.',
]

const OPEN_ITEMS_EN: string[] = [
  'The commission percentage and whether it’s calculated on the gross amount charged to the customer or on a different amount.',
  'Currency, invoice payment deadline, any fees, and the rules for corrections.',
  'The tax treatment of the service the Slovenian company invoices to the partner in Serbia, including VAT and any registration obligations.',
  'Whether this specific model requires registration, fiscalization, a local representative or an additional filing in Serbia.',
  'Details of the partner’s representative, registration, address, tax ID and complaints contact.',
  'The legal basis, technical implementation and retention period for GPS data; GPS must not be the sole proof of pickup.',
  'Final terms for reservations, no-shows, cancellations and objections.',
  'Governing law, jurisdiction and the dispute-resolution procedure (agreement, Article 10).',
  'Deadlines in brackets: objection to the report [5] business days, payment [15] days, notice period [30] days.',
]

const CONTENT: Record<Lang, { versionLabel: string; summary: string[]; sections: Section[]; openItems: string[]; path: string }> = {
  sr: { versionLabel: VERSION_LABEL.sr, summary: SUMMARY_SR, sections: SECTIONS_SR, openItems: OPEN_ITEMS_SR, path: LEGAL_PATHS.partnerTerms },
  en: { versionLabel: VERSION_LABEL.en, summary: SUMMARY_EN, sections: SECTIONS_EN, openItems: OPEN_ITEMS_EN, path: '/partner-terms' },
}

/** Text with "[…]" parts shown as "for review" badges (values the documents leave open). */
function Rich({ text, lang }: { text: string; lang: Lang }) {
  const t = (s: string) => (lang === 'sr' ? localize(s) : s)
  const parts = t(text).split(/(\[[^\]]*\])/)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('[') && part.endsWith(']') ? (
          <mark key={i} title={t(lang === 'sr' ? 'Nije konačno – za dopunu ili proveru' : 'Not final – to be completed or verified')} className="rounded bg-accent/30 px-1 font-semibold text-foreground">
            {part.slice(1, -1) || '___'}
            <span className="ml-1 text-[10px] font-bold tracking-wide uppercase opacity-70">{lang === 'sr' ? 'za proveru' : 'for review'}</span>
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

function BlockView({ block, lang }: { block: Block; lang: Lang }): ReactNode {
  const t = (s: string) => (lang === 'sr' ? localize(s) : s)
  if ('p' in block) {
    // "Član 3 – …" / "Article 3 – …" / "Hrana i prodaja. …": bold lead-in.
    const lead = /^((?:Član|Article) \d+ – [^.:]+[.:]|[A-ZČĆŠŽĐ][^.:]{2,40}\.)\s/.exec(block.p)
    return (
      <p className="text-sm leading-relaxed">
        {lead ? (
          <>
            <strong>{t(lead[1])}</strong> <Rich text={block.p.slice(lead[0].length)} lang={lang} />
          </>
        ) : (
          <Rich text={block.p} lang={lang} />
        )}
      </p>
    )
  }
  if ('list' in block)
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        {block.list.map((item) => (
          <li key={item}>
            <Rich text={item} lang={lang} />
          </li>
        ))}
      </ul>
    )
  if ('ol' in block)
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:font-bold">
        {block.ol.map((item) => (
          <li key={item}>
            <Rich text={item} lang={lang} />
          </li>
        ))}
      </ol>
    )
  if ('note' in block)
    return (
      <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <Rich text={block.note} lang={lang} />
      </p>
    )
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        {block.head && (
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">{t(block.head[0])}</th>
              <th className="px-3 py-2 font-semibold">{t(block.head[1])}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {block.table.map(([label, value]) => (
            <tr key={label} className="border-t first:border-t-0">
              <th scope="row" className="w-2/5 px-3 py-2 align-top font-medium text-muted-foreground">
                {t(label)}
              </th>
              <td className="px-3 py-2 align-top">
                <Rich text={value} lang={lang} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const LABELS: Record<Lang, Record<string, string>> = {
  sr: {
    heading: 'Pravila za partnere',
    print: 'Štampaj',
    draftTitle: 'Nacrt – nije konačna pravna verzija',
    draftText:
      'Sadržaj je preuzet iz radnih nacrta Foodnesi pravnog i operativnog paketa (pravna i poreska provera obavezna). Nije zamena za pravni ili poreski savet i nije pravno potvrđen. Vrednosti označene sa „za proveru“ još nisu dogovorene. Formalni ugovor i komercijalni uslovi (Prilog A) zaključuju se zasebno, potpisom.',
    summaryTitle: 'Ukratko',
    howTitle: 'Kako se pravila prihvataju',
    how1: 'Ugovor, Prilog A i Prilog B potpisuju se sa Foodnesi timom, van aplikacije. Tim u sistemu beleži da je postupak završen.',
    how2: 'Prilog C (operativna pravila) vlasnik partnerskog naloga izričito prihvata u portalu za partnere; čuvaju se verzija pravila i vreme prihvatanja. Ponude se mogu objaviti tek posle tog prihvatanja.',
    how3: 'Otvaranje ove stranice ili prijem e-maila ne znači prihvatanje pravila.',
    toc: 'Sadržaj',
    openTitle: 'Šta još nije konačno',
    openIntro: 'Prema uputstvu uz paket, pre potpisivanja se obavezno dopunjuje i proverava:',
    terms: 'Uslovi korišćenja',
    privacy: 'Politika privatnosti',
    contact: 'Pišite nam',
    contactHref: '/kontakt?tema=partnerstvo',
  },
  en: {
    heading: 'Partner Rules',
    print: 'Print',
    draftTitle: 'Draft – not a final legal version',
    draftText:
      'This content is taken from working drafts of the Foodnesi legal and operational package (legal and tax review mandatory). It is not a substitute for legal or tax advice and has not been legally confirmed. Values marked “for review” have not yet been agreed. The formal agreement and commercial terms (Annex A) are concluded separately, by signature.',
    summaryTitle: 'In short',
    howTitle: 'How the rules are accepted',
    how1: 'The agreement, Annex A and Annex B are signed with the Foodnesi team, outside the app. The team records in the system that the process is complete.',
    how2: 'Annex C (operating rules) is expressly accepted by the partner account owner in the partner portal; the rules version and the time of acceptance are recorded. Offers can only be published after that acceptance.',
    how3: 'Opening this page or receiving an email does not mean the rules have been accepted.',
    toc: 'Contents',
    openTitle: 'What’s still not final',
    openIntro: 'Per the instructions accompanying the package, before signing the following must be completed and verified:',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    contact: 'Contact us',
    contactHref: '/kontakt?tema=partnerstvo',
  },
}

export function PartnerTermsPage({ lang = 'sr' }: { lang?: Lang }) {
  const c = CONTENT[lang]
  const l = LABELS[lang]
  const t = (s: string) => (lang === 'sr' ? localize(s) : s)

  return (
    <div className="mx-auto max-w-3xl" lang={lang === 'en' ? 'en' : undefined}>
      <div className="mb-2 flex justify-end">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm font-semibold" role="group" aria-label="Language / Jezik">
          {(['sr', 'en'] as const).map((lo) => (
            <Link
              key={lo}
              to={CONTENT[lo].path}
              aria-current={lo === lang ? 'page' : undefined}
              className={lo === lang ? 'rounded-full bg-card px-3 py-1 shadow-sm' : 'rounded-full px-3 py-1 text-muted-foreground'}
            >
              {lo === 'sr' ? 'Srpski' : 'English'}
            </Link>
          ))}
        </div>
      </div>

      <PageHeader
        title={t(l.heading)}
        subtitle={lang === 'sr' ? t(`Uslovi korišćenja Foodnesi platforme za poslovne partnere. ${c.versionLabel}`) : `Terms of use of the Foodnesi platform for business partners. ${c.versionLabel}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer />
            {t(l.print)}
          </Button>
        }
      />

      <div role="note" className="mb-4 space-y-1 rounded-xl border border-accent bg-accent/20 p-4 text-sm">
        <p className="flex items-center gap-2 font-bold">
          <AlertTriangle className="size-4 shrink-0" />
          {t(l.draftTitle)}
        </p>
        <p className="leading-relaxed">{t(l.draftText)}</p>
      </div>

      <Card className="mb-4 space-y-3 p-5 sm:p-6">
        <h2 className="text-lg font-bold">{t(l.summaryTitle)}</h2>
        <ul className="space-y-2 text-sm leading-relaxed">
          {c.summary.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4 space-y-2 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FileSignature className="size-5 text-primary" />
          {t(l.howTitle)}
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>{t(l.how1)}</li>
          <li>{t(l.how2)}</li>
          <li>{t(l.how3)}</li>
        </ul>
      </Card>

      <nav aria-label={t(l.toc)} className="mb-4 rounded-xl bg-muted/50 p-4 text-sm print:hidden">
        <p className="mb-2 font-semibold">{t(l.toc)}</p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {c.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">
                {t(s.title)}
              </a>
            </li>
          ))}
          <li>
            <a href="#open-items" className="text-primary hover:underline">
              {t(l.openTitle)}
            </a>
          </li>
        </ol>
      </nav>

      <Card className="space-y-8 p-5 sm:p-8">
        {c.sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 space-y-3">
            <div>
              <h2 className="text-lg font-bold">{t(s.title)}</h2>
              {s.kicker && <p className="text-xs font-semibold text-muted-foreground">{t(s.kicker)}</p>}
            </div>
            {s.blocks.map((b, i) => (
              <BlockView key={i} block={b} lang={lang} />
            ))}
          </section>
        ))}

        <section id="open-items" className="scroll-mt-24 space-y-3 rounded-xl border border-dashed p-4">
          <h2 className="text-lg font-bold">{t(l.openTitle)}</h2>
          <p className="text-sm text-muted-foreground">{t(l.openIntro)}</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {c.openItems.map((item) => (
              <li key={item}>
                <Rich text={item} lang={lang} />
              </li>
            ))}
          </ul>
        </section>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to={lang === 'sr' ? LEGAL_PATHS.terms : '/terms'} className="underline">
          {t(l.terms)}
        </Link>
        {' · '}
        <Link to={lang === 'sr' ? LEGAL_PATHS.privacy : '/privacy'} className="underline">
          {t(l.privacy)}
        </Link>
        {' · '}
        <Link to={l.contactHref} className="underline">
          {t(l.contact)}
        </Link>
      </p>
    </div>
  )
}
