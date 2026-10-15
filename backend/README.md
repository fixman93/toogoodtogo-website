# Zalogaj API

This is the REST API for the Zalogaj marketplace. It uses Node.js, Express 5,
TypeScript, MongoDB (Mongoose 8), Zod validation and JWT bearer auth.

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run seed      # test partner + customer (development only)
npm run dev       # http://localhost:4000/api, check /api/health
```

| Command | Description |
| --- | --- |
| `npm run dev` | Start with auto-reload (`tsx watch`) |
| `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| `npm run typecheck` | TypeScript check only |
| `npm run seed` | **Drops the database** and loads one test partner (3 locations, offers for 3 days) + a test customer. Refuses when `NODE_ENV=production` or when real accounts exist (`--force` overrides) |
| `npm run set-role -- <email> <customer\|business\|admin>` | Grant a role to an existing account (e.g. make yourself admin) |

### Environment variables

The server validates all variables at startup and exits with a clear message
if any are missing.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | ✅ | – | Atlas or local connection string |
| `JWT_SECRET` | ✅ | – | ≥ 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_EXPIRES_IN` | | `7d` | |
| `PORT` | | `4000` | |
| `NODE_ENV` | | `development` | `production` hides internal error details |
| `CORS_ORIGINS` | | `http://localhost:5173` | Comma-separated list of browser origins |
| `MONGODB_TRANSACTIONS` | | `auto` | `auto` / `on` / `off` (see below) |
| `DEFAULT_MARKET` | | `RS` | Market from `src/config/markets.ts` |
| `AUTH_RATE_LIMIT_MAX` | | `20` | Login/register attempts per IP per 15 min |

`.env` is git-ignored. Never commit real credentials.

### Connecting MongoDB Atlas

1. Create a cluster. The free M0 tier works.
2. **Database Access**: create a database user with a strong password.
3. **Network Access**: add your IP for development. For production, add your
   host's egress IPs (or use VPC peering or private endpoints).
4. **Connect → Drivers**: copy the connection string, put the database name
   after the host, and set it in `.env`:
   `MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/zalogaj?retryWrites=true&w=majority`
   URL-encode special characters in the password.
5. Run `npm run seed`, then `npm run dev`. The log should say
   `transactions: on`.

For local development without Atlas, use `mongodb://127.0.0.1:27017/zalogaj`.
A standalone local server works too; see the next section.

## Reservations and inventory

The reservation code lives in `src/services/reservation.service.ts`.

* **No overselling.** The stock check and the decrement are a single
  conditional update:
  `findOneAndUpdate({ _id, status: 'active', pickupEnd > now, quantityAvailable ≥ qty, maxPerReservation ≥ qty }, { $inc: { quantityAvailable: -qty } })`.
  MongoDB applies it atomically per document, so concurrent requests can't
  push stock below zero. In testing, 10 parallel requests for 3 bags gave
  exactly 3 reservations and 7 `409 SOLD_OUT` responses.
* **Price snapshot.** The reservation stores `unitPriceMinor`,
  `originalUnitPriceMinor`, `totalMinor`, currency, title and pickup window as
  they were at booking time.
* **Pickup:** staff scan the customer's QR code (or type the short code).
  Collecting is a status-guarded update, so it happens exactly once.
  Pay-at-pickup reservations are recorded as `payment.status = 'paid'`.
  Staff responses include the customer's name; customers never see other
  users' data.
* **Statuses:** `pending_payment` (reserved for online payments) →
  `confirmed` → `collected` | `cancelled` | `expired`.
  * A background job runs every 5 minutes and marks unclaimed reservations
    `expired` once the grace period after pickup has passed.
* **Cancellation rules** come from the market config:
  * Customers may cancel until `cancellationCutoffMinutes` before pickup
    starts. In Serbia that is 30 minutes.
  * The business may cancel any active reservation.
  * Cancellation is idempotent: a status-guarded update restores stock exactly
    once.
* **Transactions.** Creating a reservation touches two documents: the offer
  decrement and the reservation insert. `utils/transaction.ts` handles both
  setups:
  * On a **replica set or sharded cluster**, which includes **every MongoDB
    Atlas tier**, both writes run in one multi-document transaction.
  * On a **standalone** `mongod`, which doesn't support transactions, each
    step is still atomic. If a later step fails, a compensating update (e.g.
    restocking) runs.
  * `MONGODB_TRANSACTIONS=on` makes the server refuse to start without
    transaction support. Use it in production.
* **Payments later:** create the reservation as `pending_payment` with
  `payment.method = 'online'` and `payment.holdExpiresAt`. Confirm it from the
  payment provider's webhook, and release stock when the hold expires. The
  cancellation path already marks where refunds belong.

## API

Base path: `/api`. Requests and responses are JSON.

* Success: `{ "data": … }`, or `{ "data": [...], "meta": { page, limit, total } }` for lists.
* Error: `{ "error": { "code": "SOLD_OUT", "message": "…", "details"?: … } }`.
* Status codes: `400` validation, `401` not authenticated, `403` not allowed,
  `404` not found, `409` conflict (sold out, duplicates, invalid state), `429`
  rate limited.
* Auth: `Authorization: Bearer <token>` from login/register.
* Money is in integer minor units; dates are ISO-8601 UTC.

| Method & path | Access | Notes |
| --- | --- | --- |
| `POST /auth/register` | public, rate-limited | Always creates a `customer` |
| `POST /auth/login` | public, rate-limited | |
| `GET /auth/me` | user | |
| `PATCH /admin/users/:id/role` | admin | Grant the `business` / `admin` role |
| `GET /businesses` | public | `?city=&category=&page=&limit=`; `?owner=me` lists your own |
| `GET /businesses/:id` | public | Inactive businesses are visible only to the owner or an admin |
| `POST /businesses` | business, admin | Timezone and currency default from the market |
| `PATCH /businesses/:id` | owner, admin | Syncs denormalized offer fields; deactivating pauses offers |
| `GET /businesses/:id/offers` | owner, admin | All of a location's offers incl. paused and past (partner portal) |
| `GET /businesses/:id/reviews` | public | |
| `POST /businesses/:id/reviews` | user | Needs one of *your* **collected** reservations at that business; one review per reservation |
| `GET /offers` | public | `q, category, businessId, lat, lng, maxDistanceKm, maxPriceMinor, pickupDay=today\|tomorrow, timeOfDay=morning\|afternoon\|evening, sort=distance\|price\|popularity\|pickup, page, limit` |
| `GET /offers/:id` | public | |
| `POST /offers` | owner of `businessId`, admin | |
| `PATCH /offers/:id` | owner, admin | Changing `quantityTotal` shifts availability by the same amount; it can't go below what's already reserved |
| `DELETE /offers/:id` | owner, admin | `409` while reservations are active; offers with past reservations are archived |
| `GET /reservations` | user | `?scope=upcoming\|history\|all`; owners can pass `?businessId=` |
| `GET /reservations/:id` | customer, business owner, admin | Anyone else gets `404` |
| `POST /reservations` | user | `{ offerId, quantity }` |
| `PATCH /reservations/:id/cancel` | customer, business owner, admin | Follows the cancellation rules |
| `PATCH /reservations/:id/collect` | business owner, admin | Marks the pickup as done (from the list) |
| `POST /reservations/collect` | business, admin | `{ code, reservationId? }` from a QR scan or typed code. Only searches your own businesses. `409 ALREADY_COLLECTED / RESERVATION_CANCELLED / RESERVATION_EXPIRED / AMBIGUOUS_CODE`, `404 CODE_NOT_FOUND` |
| `GET /favorites` | user | Expanded with business (+ active offer count) or offer |
| `POST /favorites` | user | `{ targetType: 'business'\|'offer', targetId }`; idempotent |
| `DELETE /favorites/:id` | owner | |
| `GET /health` | public | |

## Structure

```text
src/
├── app.ts / server.ts      # Express app factory / startup, expiry job, graceful shutdown
├── config/                 # env (Zod-validated), db connection, markets
├── models/                 # User, Business, Offer, Reservation, Favorite, Review
├── validators/             # Zod schemas per resource
├── middleware/             # authenticate / optionalAuth / requireRole, errors
├── controllers/            # HTTP layer: parse input → call service → respond
├── services/               # Business logic and authorization (ownership checks)
├── routes/                 # Routers mounted under /api
├── utils/                  # ApiError, response helpers, serializers, time zones, transactions
├── types/                  # Express request augmentation
├── scripts/                # set-role CLI
└── seed/                   # Test data + seed script
```

Design notes:

* **Geo search.** Offers keep a denormalized GeoJSON `location`, business name
  and city, so `$geoNear` with a 2dsphere index handles distance filtering and
  sorting in a single query. `PATCH /businesses/:id` keeps these copies in
  sync.
* **One business per location.** A chain registers each store as its own
  business under the same owner account.
* **Timezones.** Times are stored in UTC. Each offer carries its business's
  IANA timezone, which drives "today/tomorrow" and time-of-day filters.

## Production checklist

* `NODE_ENV=production` and `MONGODB_TRANSACTIONS=on`, with a strong unique
  `JWT_SECRET`.
* Set `CORS_ORIGINS` to the real web origin(s).
* Run behind HTTPS. `trust proxy` is enabled for one proxy hop, which the rate
  limiter needs.
* Run only one instance of the expiry job, or move it to a scheduled worker,
  once you scale horizontally.
