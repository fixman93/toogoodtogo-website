# Privatnost i pravne obaveze – Foodnesi

Radni spisak, nije pravni savet. Pre objavljivanja neka tekstove pregleda
pravnik koji radi zaštitu podataka.

## Koji propisi važe

| Zemlja | Propis |
|---|---|
| Srbija | Zakon o zaštiti podataka o ličnosti (ZZPL, 2018) – po uzoru na GDPR; nadzor: Poverenik (poverenik.rs) |
| Hrvatska, Slovenija | GDPR direktno (EU) |
| BiH, Crna Gora, Severna Makedonija | Nacionalni zakoni o zaštiti ličnih podataka, usklađeni ili u usklađivanju sa GDPR-om |
| Sve | Zakon o elektronskoj trgovini (podaci o pružaocu usluge na sajtu), zaštita potrošača |

Pošto Foodnesi radi i sa korisnicima iz EU (HR, SI), aplikacija je napravljena
po GDPR standardu – on pokriva i zahteve ostalih zemalja.

## Šta je već urađeno u aplikaciji

- Politika privatnosti i Uslovi korišćenja na engleskom (`/privacy`, `/terms` – na njih vode linkovi u aplikaciji) i srpskom (`/privatnost`, `/uslovi`), linkovi u futeru, u Profilu, pri registraciji i prijavi za partnera.
- Brisanje naloga u Profilu (ime, e-pošta, telefon, fotografija, uređaji za obaveštenja se uklanjaju).
- „Preuzmi moje podatke" u Profilu – svi podaci o korisniku u JSON fajlu (pravo na pristup i prenosivost).
- Bez kolačića za praćenje i bez analitike → nije potreban „cookie banner".
- Font se isporučuje sa sajta (nema slanja IP adresa Google-u).
- Podaci u EU: MongoDB Atlas (AWS Frankfurt), Heroku (region EU).
- Lozinke šifrovane (bcrypt), HTTPS, pristup timu po ulogama, dnevnik admin radnji.
- Partner vidi samo ime kupca i rezervaciju, ne e-poštu ni telefon; uz ocene se javno vidi ime + inicijal.

## Šta ti treba da uradiš

1. **Popuni podatke o firmi** u `src/config/legal.ts` (naziv, adresa, matični broj, PIB, e-pošta za privatnost i podršku). Dok su u [zagradama], na stranicama stoji upozorenje.
2. **Prihvati ugovore o obradi (DPA)** kod pružalaca usluga – obično u podešavanjima naloga: MongoDB Atlas, Heroku/Salesforce, Vercel, Cloudflare, MailerSend.
3. **Evidencija radnji obrade** – kratak dokument (koje podatke, zašto, koliko dugo, ko ima pristup). Sadržaj je praktično odeljci 2–6 Politike privatnosti.
4. **Ugovor sa partnerima** – uključi pravila iz „Uslovi za partnere" (skeniranje QR koda, provizija, sporovi) i obavezu da podatke kupaca koriste samo za izdavanje rezervacija.
5. **Postupak za zahteve korisnika** – ko odgovara na mejl za privatnost (rok 30 dana) i šta se radi kod curenja podataka (prijava Povereniku u roku od 72 sata).
6. Lice za zaštitu podataka (DPO) **nije obavezno** za ovakvu obradu dok nema velikog sistematskog praćenja; proveri sa pravnikom kada broj korisnika poraste.

## App Store – „App Privacy" (podaci za Apple)

Tracking (praćenje korisnika preko drugih aplikacija): **Ne**.

| Kategorija (Apple) | Podatak | Svrha | Povezano sa korisnikom |
|---|---|---|---|
| Contact Info | Name, Email Address, Phone Number | App Functionality | Da |
| User Content | Photos (profilna slika), Customer Support, Other User Content (ocene) | App Functionality | Da |
| Purchases | Purchase History (rezervacije) | App Functionality | Da |
| Location | Precise Location | App Functionality | Ne (ne čuva se uz nalog) |
| Identifiers | User ID | App Functionality | Da |

Nema: Health, Financial Info (plaćanje je u lokalu), Browsing History, Search
History, Contacts, Diagnostics, Usage Data, Advertising.

U App Store Connect unesi i URL politike privatnosti:
`https://<tvoj-domen>/privacy` (engleski; srpska verzija je na `/privatnost`). Brisanje naloga u aplikaciji (Apple pravilo
5.1.1(v)) – postoji u Profilu.
