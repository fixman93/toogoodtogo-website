# Zalogaj – food-saving marketplace (MERN)

Zalogaj lets bakeries, restaurants, supermarkets and other food businesses sell
their end-of-day surplus as discounted "surprise bags". Customers reserve a
bag and collect it in a set pickup window. The first market is **Serbia**
(Serbian Latin script, ekavica, RSD). The architecture is ready for more
countries.

| Part | Stack | Location |
| --- | --- | --- |
| Web app | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router, TanStack Query, Axios | repository root (`src/`) |
| API | Node.js, Express 5, TypeScript, MongoDB + Mongoose, Zod, JWT | [`backend/`](backend/README.md) |

The two apps are independent: each has its own `package.json`, `.env` and
commands. The same REST API is meant to serve future native iOS/Android apps.

```text
.
├── src/                    # Web app (existing Vite project, kept in the root)
│   ├── api/                # Axios client, endpoint functions, API types
│   ├── components/         # ui/ (shadcn), layout/, offers/, reservations/, common/
│   ├── config/markets.ts   # Country settings: locale, currency, timezone, cities
│   ├── features/           # auth/ and location/ providers
│   ├── hooks/api.ts        # TanStack Query hooks (only way screens load data)
│   ├── i18n/               # Message catalogues (sr-Latn) + t()
│   ├── lib/                # formatting (money/time/distance), geo, time zones
│   └── pages/              # Discover, Browse, Offer, Reservations, Favorites, Profile, Auth, Business
├── backend/                # Express API (see backend/README.md)
├── components.json         # shadcn/ui CLI config
├── .env.example            # Frontend environment variables (local overrides → .env.local)
├── .env.production         # Production API URL used by Vercel builds (no secrets)
└── vercel.json             # SPA routing for Vercel
```

## Deployment

| Part | Where | Notes |
| --- | --- | --- |
| Web app | Vercel (`toogoodtogo-website.vercel.app`) | Builds use `.env.production` → API on Heroku |
| API | Heroku app `toogoodtogo-web` | Monorepo buildpack + `APP_BASE=backend`; config in Heroku Config Vars |
| Database | MongoDB Atlas, database `zalogaj` | Network Access must allow Heroku (`0.0.0.0/0`) |

## Quick start (local development)

Requirements: Node.js 22 and npm.

```bash
# Terminal 1 – API (needs backend/.env with MONGODB_URI and JWT_SECRET)
cd backend
npm install
npm run dev              # http://localhost:4000/api

# Terminal 2 – web app
npm install
npm run dev              # http://localhost:5173
```

The browser calls `/api/...` on the Vite origin, and Vite proxies those calls
to the backend, so no CORS setup is needed. To develop the UI without running
the backend locally, set
`VITE_API_PROXY_TARGET=https://toogoodtogo-web-cfccb22f0618.herokuapp.com` in
`.env.local`. A phone on the same Wi-Fi can open
`http://<your-computer-ip>:5173` (start Vite with `npm run dev -- --host`).

### Test accounts

`cd backend && npm run seed` replaces the database with clean test data:

* **Test Partner** (`test.partner@zalogaj.rs`): three locations, *Test
  Pekara – Dorćol / Vračar / Novi Beograd*, with offers for the next 3 days.
* **Test Kupac** (`test.kupac@zalogaj.rs`).

The script prints the password (or set `SEED_PASSWORD`). Re-run it to get
fresh offers. It refuses to wipe a database that contains any other (real)
account.

### Admin panel

`/admin` (admin role only; linked from the Profile page):

* **Pregled:** users, partners, locations, live offers and reservations at a glance.
* **Korisnici:** search users and change their role (Kupac / Partner /
  Admin). This is how a business becomes a partner: it registers on the site,
  then an admin switches it to *Partner*. The change applies immediately; the
  user doesn't have to sign in again.
* **Lokacije:** every partner location with its owner. **Isključi** hides a
  location and pauses its offers.

Safeguards: an admin can't change their own role, and the last admin can't be
demoted. The very first admin is created from the terminal:
`cd backend && npm run set-role -- you@example.com admin`.

## Frontend commands

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint (ignores `backend/`, which is linted by its own type-check) |

## Frontend environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | API base URL. `.env.production` sets the Heroku URL for Vercel builds |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Where the dev server proxies `/api` |
| `VITE_MARKET` | `RS` | Market from `src/config/markets.ts` |

`VITE_*` values are compiled into the public bundle, so never put secrets there.

## How the data layer works

```
page → hooks/api.ts (TanStack Query) → api/services.ts → api/client.ts (Axios) → REST API
```

* Screens never call Axios directly. They use hooks such as `useOffers` and
  `useCreateReservation`, so loading, error and empty states work the same
  everywhere.
* `api/types.ts` documents the API contract. Money is always an **integer in
  minor units** (`priceMinor: 29900` = 299 RSD) plus a currency code. Dates are
  UTC ISO strings, shown in the business's timezone.

## Localization and markets

* All UI text lives in `src/i18n/sr-Latn.ts`, Serbian Latin ekavica. It
  includes plural forms such as "1 kesa / 2 kese / 5 kesa", picked through
  `Intl.PluralRules`.
* `src/config/markets.ts` (frontend) and `backend/src/config/markets.ts` hold
  every country-specific setting: locale, currency and minor units, timezone,
  cities, cancellation cutoff, and the per-reservation maximum.
* Prices use `Intl.NumberFormat('sr-Latn-RS')` (e.g. `1.450 RSD`). Pickup times
  are shown in the **business's** timezone, not the browser's.
* To add a country: add a market entry on both sides, add a message catalogue,
  and set `VITE_MARKET` / `DEFAULT_MARKET`.

## Pickup: QR scan at the counter

1. After reserving, the customer's reservation screen shows a **QR code** and
   the short code (e.g. `ZL-4F7K`). The QR contains `ZALOGAJ:R:<reservationId>:<code>`.
2. Staff open **Portal za partnere → Skeniraj kod** (`/business/scan`), turn on
   the camera and point it at the customer's phone. If the camera isn't
   available, they can type the code instead (`4F7K`, `zl4f7k` and `ZL-4F7K`
   all work), or press **Izdaj** in the list of expected pickups.
3. The API marks the reservation `collected`. A "pay at pickup" reservation is
   also recorded as `paid`. Staff see how many bags to hand over, the
   customer's name and the amount to charge.
4. The customer's screen polls every 5 s while the reservation is active, so it
   switches to "Preuzeto" on its own. The pickup then counts toward
   *Spašene kese / Ušteđeno* on their profile.

Safeguards:
* Codes are only looked up within the scanning account's own businesses.
* A second scan of the same code returns "već preuzeta"; it can't collect twice.
* Cancelled and expired reservations are rejected.
* Codes are unique among a location's active reservations.

**Camera needs HTTPS.** Browsers only allow camera access on `https://` or
`localhost`. To test scanning from a phone on your Wi-Fi, serve the dev server
over HTTPS (e.g. `@vitejs/plugin-basic-ssl`) or use a tunnel. Manual code entry
works everywhere.

## Map and "nearest"

* **Pretraga → Mapa** (`/browse?view=map`, also linked from Discover) opens
  at the user's **current location**: it asks for GPS on open, unless access
  was blocked.
* The map shows every location with live offers in the visible area **at any
  zoom level**, from street level to the whole country
  (`GET /api/offers/locations?minLat&maxLat&minLng&maxLng`, one row per
  location). When zoomed out, nearby pins merge into a numbered bubble;
  tapping it zooms in.
* Tapping a pin lists that location's offers. The category, price and time
  filters apply. Below the map: offers nearest to the user.
* **Najbliže meni** uses the device's real GPS position: it shows a blue dot,
  re-centers the map and sorts by real distance. Distances on cards are always
  measured from the user, not from the map center. Geolocation only works on
  HTTPS or localhost; denied or unavailable positions show a clear message.
* Leaflet is lazy-loaded, so it only downloads when the map is opened.
* OpenStreetMap labels in Serbia are Cyrillic. For Latin-script labels, or
  heavier traffic (OSM's tile policy), switch the `TileLayer` URL in
  `src/features/map/OffersMap.tsx` to a provider such as MapTiler (`sr-Latn`
  labels, needs an API key).

## Partner portal

Visible to `business` and `admin` accounts at `/business`. Account → locations → offers:

* **One account can run many locations** (`/business/locations/new`). Each
  location has its own address and map pin, phone, pickup instructions and
  images. The pin can be found from the address (OpenStreetMap Nominatim) or
  set with "Koristi moju trenutnu lokaciju".
* **Each location has many offers** (`/business/offers/new`). An offer has a
  title, description, category, tags, regular and discounted price, number of
  bags, a per-customer limit, and a pickup date and time window in the
  location's timezone.
* **Actions per offer:**
  * **Uredi:** edit the offer. The bag count can't drop below what's already
    reserved.
  * **Pauziraj / Aktiviraj:** pause or reactivate. Paused offers are hidden
    from customers.
  * **Ponovi:** a copy for the next free day.
  * **Obriši:** delete, right from the list (past offers too). Blocked while
    there are active reservations. Offers with past reservations are archived
    rather than removed.
* **Deleting a location** works from its card or its edit page. It is
  blocked while customers still have bags to collect. A location with history
  (past reservations or reviews) is hidden everywhere but kept, so customers
  keep their reservation history. A location without history is removed
  together with its offers.
* Past offers are listed separately, and "Ponovi" works on them too.
* **Skeniraj kod** (`/business/scan`) handles pickups (see above).
* **Prodaja i stanje** (`/business/sales`, plus a "Danas" summary at the top
  of the portal) covers any day (yesterday, today, tomorrow or a date) per
  location and per offer:
  * bags sold, collected, waiting for pickup, not collected and cancelled;
  * what's still in stock;
  * revenue collected and revenue still expected.

  It refreshes every 30 s (`GET /api/partner/sales?date=YYYY-MM-DD`).

The API enforces ownership on every call: a partner only ever sees and changes
their own locations and offers (`GET /api/businesses/:id/offers` is the
owner-only list that includes paused and past offers).

Planned next: recurring offers (e.g. "every weekday 19:30–20:30, 8 bags"),
image upload, and staff accounts per location.

## Not included yet

* **Payments.** Reservations are `confirmed` with "pay at pickup". The model
  already has `pending_payment`, `payment.status/provider/holdExpiresAt` and a
  refund hook in cancellation (see `backend/README.md`).
* Native mobile apps. They can use the same REST API and JWT bearer auth.
