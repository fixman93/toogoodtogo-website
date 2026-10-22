import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, CheckCircle2, FileSignature, Printer } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LEGAL_PATHS } from '@/config/legal'
import { localize } from '@/i18n'

/**
 * /partner-uslovi — rules for business partners, taken from the "foODnesi Pravni i
 * operativni paket" (verzija 2.0, 22. 10. 2026): Ugovor o korišćenju platforme,
 * Prilog A, B i C, pravila za reklamacije, mesečni izveštaj i faktura. The package
 * is a working draft ("pravna i poreska provera obavezna"), so the page says so and
 * every value in [brackets] is shown as "za proveru". Do not add terms that are not
 * in the documents; update the version in config/legal.ts (both apps) on changes.
 */

const VERSION_LABEL = 'Verzija 2.0 od 22. oktobra 2026.'
const SUPPORT_EMAIL = 'civcicboris93@gmail.com'

type Block = { p: string } | { list: string[] } | { ol: string[] } | { table: [string, string][]; head?: [string, string] } | { note: string }
type Section = { id: string; title: string; kicker?: string; blocks: Block[] }

const SUMMARY: string[] = [
  'Foodnesi je digitalna platforma koja povezuje kupce sa nezavisnim partnerima. Partner je prodavac hrane kupcu.',
  'Kupac rezerviše kesu u aplikaciji, preuzima je na lokaciji partnera i cenu hrane plaća direktno partneru, koji izdaje račun. Foodnesi ne prima cenu hrane, ne priprema, ne skladišti i ne dostavlja hranu u okviru ovog poslovnog modela.',
  'Partner odgovara za zakonitost ponude, poreklo, ispravnost i bezbednost hrane, skladištenje, higijenu, rokove, alergene i druge obavezne informacije.',
  'Preuzimanje se evidentira skeniranjem QR koda kupca ili odobrenim rezervnim postupkom. QR evidencija je primarni zapis o preuzimanju; GPS je samo dopunski signal.',
  'Provizija se duguje samo za rezervacije koje su stvarno preuzete i za koje je partner naplatio cenu hrane. Stopa, osnovica, valuta i rok plaćanja određuju se u Prilogu A.',
  'Reklamacije na hranu rešava partner; tehničke probleme, netačnu evidenciju i sadržaj na platformi prijavljujete Foodnesi timu.',
]

const SECTIONS: Section[] = [
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

/** "Pre potpisivanja obavezno dopuniti i proveriti" (Uputstvo i kontrolna lista). */
const OPEN_ITEMS: string[] = [
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

/** Text with "[…]" parts shown as "za proveru" badges (values the documents leave open). */
function Rich({ text }: { text: string }) {
  const parts = localize(text).split(/(\[[^\]]*\])/)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('[') && part.endsWith(']') ? (
          <mark key={i} title={localize('Nije konačno – za dopunu ili proveru')} className="rounded bg-accent/30 px-1 font-semibold text-foreground">
            {part.slice(1, -1) || '___'}
            <span className="ml-1 text-[10px] font-bold tracking-wide uppercase opacity-70">{localize('za proveru')}</span>
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

function BlockView({ block }: { block: Block }): ReactNode {
  if ('p' in block) {
    // "Član 3 – …" / "Hrana i prodaja. …": bold lead-in.
    const lead = /^(Član \d+ – [^.:]+[.:]|[A-ZČĆŠŽĐ][^.:]{2,40}\.)\s/.exec(block.p)
    return (
      <p className="text-sm leading-relaxed">
        {lead ? (
          <>
            <strong>{localize(lead[1])}</strong> <Rich text={block.p.slice(lead[0].length)} />
          </>
        ) : (
          <Rich text={block.p} />
        )}
      </p>
    )
  }
  if ('list' in block)
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        {block.list.map((item) => (
          <li key={item}>
            <Rich text={item} />
          </li>
        ))}
      </ul>
    )
  if ('ol' in block)
    return (
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:font-bold">
        {block.ol.map((item) => (
          <li key={item}>
            <Rich text={item} />
          </li>
        ))}
      </ol>
    )
  if ('note' in block)
    return (
      <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <Rich text={block.note} />
      </p>
    )
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        {block.head && (
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">{localize(block.head[0])}</th>
              <th className="px-3 py-2 font-semibold">{localize(block.head[1])}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {block.table.map(([label, value]) => (
            <tr key={label} className="border-t first:border-t-0">
              <th scope="row" className="w-2/5 px-3 py-2 align-top font-medium text-muted-foreground">
                {localize(label)}
              </th>
              <td className="px-3 py-2 align-top">
                <Rich text={value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PartnerTermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={localize('Pravila za partnere')}
        subtitle={localize(`Uslovi korišćenja Foodnesi platforme za poslovne partnere. ${VERSION_LABEL}`)}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer />
            {localize('Štampaj')}
          </Button>
        }
      />

      <div role="note" className="mb-4 space-y-1 rounded-xl border border-accent bg-accent/20 p-4 text-sm">
        <p className="flex items-center gap-2 font-bold">
          <AlertTriangle className="size-4 shrink-0" />
          {localize('Nacrt – nije konačna pravna verzija')}
        </p>
        <p className="leading-relaxed">
          {localize(
            'Sadržaj je preuzet iz radnih nacrta Foodnesi pravnog i operativnog paketa (pravna i poreska provera obavezna). Nije zamena za pravni ili poreski savet i nije pravno potvrđen. Vrednosti označene sa „za proveru“ još nisu dogovorene. Formalni ugovor i komercijalni uslovi (Prilog A) zaključuju se zasebno, potpisom.',
          )}
        </p>
      </div>

      <Card className="mb-4 space-y-3 p-5 sm:p-6">
        <h2 className="text-lg font-bold">{localize('Ukratko')}</h2>
        <ul className="space-y-2 text-sm leading-relaxed">
          {SUMMARY.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{localize(item)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4 space-y-2 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FileSignature className="size-5 text-primary" />
          {localize('Kako se pravila prihvataju')}
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>{localize('Ugovor, Prilog A i Prilog B potpisuju se sa Foodnesi timom, van aplikacije. Tim u sistemu beleži da je postupak završen.')}</li>
          <li>{localize('Prilog C (operativna pravila) vlasnik partnerskog naloga izričito prihvata u portalu za partnere; čuvaju se verzija pravila i vreme prihvatanja. Ponude se mogu objaviti tek posle tog prihvatanja.')}</li>
          <li>{localize('Otvaranje ove stranice ili prijem e-maila ne znači prihvatanje pravila.')}</li>
        </ul>
      </Card>

      <nav aria-label={localize('Sadržaj')} className="mb-4 rounded-xl bg-muted/50 p-4 text-sm print:hidden">
        <p className="mb-2 font-semibold">{localize('Sadržaj')}</p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">
                {localize(s.title)}
              </a>
            </li>
          ))}
          <li>
            <a href="#otvorena-pitanja" className="text-primary hover:underline">
              {localize('Šta još nije konačno')}
            </a>
          </li>
        </ol>
      </nav>

      <Card className="space-y-8 p-5 sm:p-8">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 space-y-3">
            <div>
              <h2 className="text-lg font-bold">{localize(s.title)}</h2>
              {s.kicker && <p className="text-xs font-semibold text-muted-foreground">{localize(s.kicker)}</p>}
            </div>
            {s.blocks.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </section>
        ))}

        <section id="otvorena-pitanja" className="scroll-mt-24 space-y-3 rounded-xl border border-dashed p-4">
          <h2 className="text-lg font-bold">{localize('Šta još nije konačno')}</h2>
          <p className="text-sm text-muted-foreground">{localize('Prema uputstvu uz paket, pre potpisivanja se obavezno dopunjuje i proverava:')}</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {OPEN_ITEMS.map((item) => (
              <li key={item}>
                <Rich text={item} />
              </li>
            ))}
          </ul>
        </section>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to={LEGAL_PATHS.terms} className="underline">
          {localize('Uslovi korišćenja')}
        </Link>
        {' · '}
        <Link to={LEGAL_PATHS.privacy} className="underline">
          {localize('Politika privatnosti')}
        </Link>
        {' · '}
        <Link to="/kontakt?tema=partnerstvo" className="underline">
          {localize('Pišite nam')}
        </Link>
      </p>
    </div>
  )
}
