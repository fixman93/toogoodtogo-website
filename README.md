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
│   ├── mocks/              # Demo data + axios mock adapter (VITE_API_MODE=mock)
│   └── pages/              # Discover, Browse, Offer, Reservations, Favorites, Profile, Auth, Business
├── backend/                # Express API (see backend/README.md)
├── components.json         # shadcn/ui CLI config
└── .env.example            # Frontend environment variables
```

## Quick start

Requirements: Node.js 20.19+ (or 22.12+) and npm.

### 1. Web app only, with demo data (no backend needed)

```bash
npm install
npm run dev              # http://localhost:5173
```

Mock mode is the default. Demo login: `ana@primer.rs` / `lozinka123`.
Reservations and favorites made in mock mode are kept in `localStorage` for
the current day. You can reset them from the Profile page.

### 2. Web app + real API

```bash
# Terminal 1 – API
cd backend
cp .env.example .env     # fill in MONGODB_URI and JWT_SECRET
npm install
npm run seed             # demo data (refuses to run in production)
npm run dev              # http://localhost:4000/api

# Terminal 2 – web app
cp .env.example .env.local
# set VITE_API_MODE=http in .env.local
npm run dev
```

In development the browser calls `/api/...` on the Vite origin, and Vite
proxies those calls to the backend. That means no CORS setup is needed, and a
phone on the same Wi-Fi can open `http://<your-computer-ip>:5173` (start Vite
with `npm run dev -- --host`).

Seeded accounts all use the password `lozinka123`:

| E-mail | Role |
| --- | --- |
| `ana@primer.rs` | customer (has upcoming, collected and cancelled reservations) |
| `marko@pekaraklas.rs` | business – owns *Pekara Klas* (open `/business`) |
| `admin@zalogaj.rs` | admin |

## Frontend commands

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint (ignores `backend/`, which is linted by its own type-check) |

## Frontend environment variables (`.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_MODE` | `mock` | `mock` = bundled demo data; `http` = real API |
| `VITE_API_URL` | `/api` | API base URL. In production use the full URL, e.g. `https://api.zalogaj.rs/api` |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Where the dev server proxies `/api` |
| `VITE_MARKET` | `RS` | Market from `src/config/markets.ts` |

`VITE_*` values are compiled into the public bundle, so never put secrets there.

## How the data layer works

```
page → hooks/api.ts (TanStack Query) → api/services.ts → api/client.ts (Axios) → REST API
                                                              └─ mock mode: mocks/adapter.ts
```

* Screens never call Axios directly. They use hooks such as `useOffers` and
  `useCreateReservation`, so loading, error and empty states work the same
  everywhere.
* In mock mode, a lazy-loaded **Axios adapter** answers requests with the same
  JSON envelopes the Express API returns (`{ data }`, `{ data, meta }`,
  `{ error: { code, message } }`). Switching to the backend is just
  `VITE_API_MODE=http`, with no screen changes. The mock data lives in
  `src/mocks/` and is never imported by UI components.
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
  * **Obriši:** delete. Blocked while there are active reservations.
* Past offers are listed separately, and "Ponovi" works on them too.
* **Skeniraj kod** (`/business/scan`) handles pickups (see above).

The API enforces ownership on every call: a partner only ever sees and changes
their own locations and offers (`GET /api/businesses/:id/offers` is the
owner-only list that includes paused and past offers). In mock mode, partner
changes are saved in that browser only.

Planned next: recurring offers (e.g. "every weekday 19:30–20:30, 8 bags"),
image upload, and staff accounts per location.

## Not included yet

* **Payments.** Reservations are `confirmed` with "pay at pickup". The model
  already has `pending_payment`, `payment.status/provider/holdExpiresAt` and a
  refund hook in cancellation (see `backend/README.md`).
* Native mobile apps. They can use the same REST API and JWT bearer auth.
