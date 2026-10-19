/**
 * Pickup integrity: does a partner record every hand-over? Without online
 * payments, a partner could hand the bag over without scanning (no commission).
 * Signals, per partner, over a period of finished pickup windows:
 *
 * - no-show rate vs the platform average (unrecorded hand-overs look like no-shows);
 * - pickups the customer confirmed but the partner never recorded;
 * - customers who "never come" to the same partner yet keep reserving there;
 * - hand-overs recorded without the customer's code (list button) instead of a scan;
 * - the customer's phone was at the shop, yet nothing was recorded (or the partner cancelled).
 */
import { Types } from 'mongoose'
import { marketFor } from '../config/markets.js'
import { Business, Reservation, User } from '../models/index.js'
import { toDto } from './reservation.service.js'
import type { Actor } from './access.service.js'

type Counts = {
  total: number
  collected: number
  expired: number
  viaQr: number
  viaCode: number
  viaList: number
  viaCustomer: number
  /** Customer said "not collected" when asked. */
  customerNo: number
  /** Gross of expired reservations — the commission at stake if they were secretly handed over. */
  expiredGrossMinor: number
  /** Customer was at the shop but it wasn't scanned (expired) or the partner cancelled. */
  arrivedNotScanned: number
}

type Row = Counts & { _id: Types.ObjectId }

export type RiskFlag = 'high_no_show' | 'unscanned_pickups' | 'repeat_no_shows' | 'manual_handover' | 'arrived_not_scanned'

const MIN_SAMPLE = 8

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000)
}

/** Finished pickups (collected or expired) per location in the window. */
async function countsByBusiness(match: Record<string, unknown>, from: Date) {
  // A pickup whose dispute was upheld is back to "expired" but keeps its collectedVia — count only real pickups.
  const collected = { $eq: ['$status', 'collected'] }
  return Reservation.aggregate<Row>([
    { $match: { ...match, status: { $in: ['collected', 'expired'] }, pickupEnd: { $gte: from, $lt: new Date() } } },
    {
      $group: {
        _id: '$business',
        total: { $sum: 1 },
        collected: { $sum: { $cond: [{ $eq: ['$status', 'collected'] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
        viaQr: { $sum: { $cond: [{ $and: [collected, { $eq: ['$collectedVia', 'qr'] }] }, 1, 0] } },
        viaCode: { $sum: { $cond: [{ $and: [collected, { $eq: ['$collectedVia', 'code'] }] }, 1, 0] } },
        viaList: { $sum: { $cond: [{ $and: [collected, { $eq: ['$collectedVia', 'list'] }] }, 1, 0] } },
        viaCustomer: { $sum: { $cond: [{ $and: [collected, { $eq: ['$collectedVia', 'customer'] }] }, 1, 0] } },
        customerNo: { $sum: { $cond: [{ $eq: ['$pickupCheck.answer', 'not_collected'] }, 1, 0] } },
        expiredGrossMinor: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, '$totalMinor', 0] } },
        arrivedNotScanned: { $sum: { $cond: [{ $ifNull: ['$integrityAlert', false] }, 1, 0] } },
      },
    },
  ])
}

/** Partner-cancelled reservations with an arrival warning (not in the collected/expired counts). */
async function cancelledArrivals(match: Record<string, unknown>, from: Date) {
  const rows = await Reservation.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { ...match, status: 'cancelled', 'integrityAlert.kind': 'arrived_cancelled', pickupEnd: { $gte: from } } },
    { $group: { _id: '$business', n: { $sum: 1 } } },
  ])
  return new Map(rows.map((r) => [r._id.toString(), r.n]))
}

/** Customers with ≥ 2 no-shows at the same partner who still reserved there afterwards. */
async function repeatNoShows(businessIds: Types.ObjectId[], from: Date) {
  const rows = await Reservation.aggregate<{ _id: { business: Types.ObjectId; user: Types.ObjectId }; noShows: number; lastNoShow: Date }>([
    { $match: { business: { $in: businessIds }, status: 'expired', pickupEnd: { $gte: from }, 'pickupCheck.answer': { $ne: 'not_collected' } } },
    { $group: { _id: { business: '$business', user: '$user' }, noShows: { $sum: 1 }, lastNoShow: { $max: '$pickupEnd' } } },
    { $match: { noShows: { $gte: 2 } } },
  ])
  const result = new Map<string, number>()
  for (const r of rows) {
    const again = await Reservation.exists({ business: r._id.business, user: r._id.user, createdAt: { $gt: r.lastNoShow } })
    if (again) result.set(r._id.business.toString(), (result.get(r._id.business.toString()) ?? 0) + 1)
  }
  return result
}

const empty = (): Counts => ({ total: 0, collected: 0, expired: 0, viaQr: 0, viaCode: 0, viaList: 0, viaCustomer: 0, customerNo: 0, expiredGrossMinor: 0, arrivedNotScanned: 0 })
const add = (a: Counts, b: Counts) => {
  for (const k of Object.keys(a) as (keyof Counts)[]) a[k] += b[k]
  return a
}
const rate = (part: number, whole: number) => (whole ? part / whole : 0)

/** `othersNoShow`: no-show rate of all OTHER partners — a big partner must not hide in an average it dominates. */
function assess(c: Counts, othersNoShow: number, repeatCustomers: number) {
  const noShowRate = rate(c.expired, c.total)
  const flags: RiskFlag[] = []
  if (c.total >= MIN_SAMPLE && noShowRate >= Math.max(othersNoShow * 2, othersNoShow + 0.15)) flags.push('high_no_show')
  if (c.viaCustomer >= 2 || (c.viaCustomer >= 1 && rate(c.viaCustomer, c.collected) >= 0.1)) flags.push('unscanned_pickups')
  if (repeatCustomers >= 2) flags.push('repeat_no_shows')
  if (c.collected >= MIN_SAMPLE && rate(c.viaList, c.collected) >= 0.5) flags.push('manual_handover')
  // Hard evidence: the customer's phone was at the counter.
  if (c.arrivedNotScanned >= 1) flags.push('arrived_not_scanned')
  const risk = flags.length >= 2 || c.viaCustomer >= 3 || c.arrivedNotScanned >= 2 ? 'high' : flags.length === 1 ? 'medium' : 'low'
  return {
    noShowRate,
    scannedRate: rate(c.viaQr + c.viaCode, c.collected),
    flags,
    risk: risk as 'low' | 'medium' | 'high',
  }
}

/** Platform view: every partner with finished pickups in the period, riskiest first. */
export async function platformIntegrity(days: number) {
  const from = since(days)
  const rows = await countsByBusiness({}, from)
  // Cancelled-with-arrival is counted on top (a location may have only those).
  const cancelled = await cancelledArrivals({}, from)
  for (const [id, n] of cancelled) {
    const row = rows.find((r) => r._id.toString() === id)
    if (row) row.arrivedNotScanned += n
    else rows.push({ ...empty(), arrivedNotScanned: n, _id: new Types.ObjectId(id) })
  }
  const businesses = await Business.find({ _id: { $in: rows.map((r) => r._id) } }).select('name owner currency commissionRate address.countryCode').lean()
  const byId = new Map(businesses.map((b) => [b._id.toString(), b]))
  const repeat = await repeatNoShows(
    rows.map((r) => r._id),
    from,
  )
  const platform = rows.reduce((acc, r) => add(acc, r), empty())
  const platformNoShow = rate(platform.expired, platform.total)
  const othersRate = (own: Counts) => (platform.total - own.total > 0 ? rate(platform.expired - own.expired, platform.total - own.total) : platformNoShow)

  // Group locations by partner (owner).
  const groups = new Map<string, { counts: Counts; repeat: number; locations: string[]; currency: string; rate: number }>()
  for (const r of rows) {
    const b = byId.get(r._id.toString())
    if (!b) continue
    const key = b.owner.toString()
    const g = groups.get(key) ?? { counts: empty(), repeat: 0, locations: [], currency: b.currency, rate: b.commissionRate ?? marketFor(b.address.countryCode).commissionRate }
    add(g.counts, r)
    g.repeat += repeat.get(r._id.toString()) ?? 0
    g.locations.push(b.name)
    groups.set(key, g)
  }
  const owners = new Map((await User.find({ _id: { $in: [...groups.keys()] } }).select('name email partnerStatus').lean()).map((u) => [u._id.toString(), u]))
  const openDisputes = await Reservation.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { 'dispute.status': 'open' } },
    { $group: { _id: '$business', n: { $sum: 1 } } },
  ])
  const disputesByOwner = new Map<string, number>()
  for (const d of openDisputes) {
    const owner = byId.get(d._id.toString())?.owner.toString() ?? (await Business.findById(d._id).select('owner').lean())?.owner.toString()
    if (owner) disputesByOwner.set(owner, (disputesByOwner.get(owner) ?? 0) + d.n)
  }

  const order = { high: 0, medium: 1, low: 2 }
  const partners = [...groups.entries()]
    .map(([ownerId, g]) => {
      const owner = owners.get(ownerId)
      return {
        ownerId,
        name: owner?.name ?? '—',
        email: owner?.email ?? '',
        partnerStatus: owner?.partnerStatus ?? 'active',
        locations: g.locations,
        currency: g.currency,
        ...g.counts,
        repeatNoShowCustomers: g.repeat,
        /** Commission the platform would earn if every expired bag had been a recorded sale. */
        commissionAtRiskMinor: Math.round(g.counts.expiredGrossMinor * g.rate),
        openDisputes: disputesByOwner.get(ownerId) ?? 0,
        ...assess(g.counts, othersRate(g.counts), g.repeat),
      }
    })
    .sort((a, b) => order[a.risk] - order[b.risk] || b.noShowRate - a.noShowRate)

  return {
    days,
    platform: { ...platform, noShowRate: platformNoShow, scannedRate: rate(platform.viaQr + platform.viaCode, platform.collected) },
    partners,
  }
}

/** The partner's own numbers (no risk wording) and their customer-confirmed pickups to review/dispute. */
export async function partnerIntegrity(actor: Actor, days: number) {
  const from = since(days)
  const ids = (await Business.find({ owner: actor.id }).select('_id').lean()).map((b) => b._id)
  const [mine, all] = await Promise.all([countsByBusiness({ business: { $in: ids } }, from), countsByBusiness({}, from)])
  const counts = mine.reduce((acc, r) => add(acc, r), empty())
  const platform = all.reduce((acc, r) => add(acc, r), empty())
  const confirmed = await Reservation.find({ business: { $in: ids }, collectedVia: 'customer' }).sort({ collectedAt: -1 }).limit(50).lean()
  return {
    days,
    ...counts,
    noShowRate: rate(counts.expired, counts.total),
    scannedRate: rate(counts.viaQr + counts.viaCode, counts.collected),
    platformNoShowRate: rate(platform.expired, platform.total),
    customerConfirmed: await toDto(confirmed, actor),
  }
}

/** Open disputes for the platform team. */
export async function openDisputes(actor: Actor) {
  const rows = await Reservation.find({ 'dispute.status': 'open' }).sort({ 'dispute.openedAt': 1 }).limit(100).lean()
  return toDto(rows, actor)
}

/**
 * One partner at a glance (admin → Partneri): every reservation at their
 * locations whose pickup window started in the period, by outcome, with
 * revenue and a row per location. `days = 0` = all time.
 */
export async function partnerStats(ownerId: string, days: number) {
  const businesses = await Business.find({ owner: ownerId }).select('name currency deletedAt').lean()
  if (!businesses.length) return { days, currency: null, totals: emptyStats(), locations: [] }
  const match: Record<string, unknown> = { business: { $in: businesses.map((b) => b._id) } }
  if (days > 0) match.pickupStart = { $gte: since(days) }
  const is = (status: string) => ({ $eq: ['$status', status] })
  const sumIf = (cond: unknown, value: unknown = 1) => ({ $sum: { $cond: [cond, value, 0] } })
  const rows = await Reservation.aggregate<StatsRow & { _id: Types.ObjectId }>([
    { $match: match },
    {
      $group: {
        _id: '$business',
        total: { $sum: 1 },
        collected: sumIf(is('collected')),
        scanned: sumIf({ $and: [is('collected'), { $in: ['$collectedVia', ['qr', 'code']] }] }),
        manual: sumIf({ $and: [is('collected'), { $eq: ['$collectedVia', 'list'] }] }),
        byCustomer: sumIf({ $and: [is('collected'), { $eq: ['$collectedVia', 'customer'] }] }),
        expired: sumIf(is('expired')),
        cancelledByCustomer: sumIf({ $and: [is('cancelled'), { $ne: ['$cancelledBy', 'business'] }] }),
        cancelledByPartner: sumIf({ $and: [is('cancelled'), { $eq: ['$cancelledBy', 'business'] }] }),
        active: sumIf({ $in: ['$status', ['confirmed', 'pending_payment']] }),
        deliveries: sumIf({ $eq: ['$fulfillment', 'delivery'] }),
        bagsCollected: sumIf(is('collected'), '$quantity'),
        revenueMinor: sumIf(is('collected'), '$totalMinor'),
        expiredValueMinor: sumIf(is('expired'), '$totalMinor'),
        arrivalWarnings: sumIf({ $ne: [{ $ifNull: ['$integrityAlert', null] }, null] }),
      },
    },
  ])
  const byId = new Map(rows.map((r) => [r._id.toString(), r]))
  const locations = businesses
    .map((b) => ({ businessId: b._id.toString(), name: b.name, deleted: !!b.deletedAt, ...emptyStats(), ...strip(byId.get(b._id.toString())) }))
    .filter((l) => !l.deleted || l.total > 0)
    .sort((a, b) => b.total - a.total)
  const totals = emptyStats()
  for (const l of locations) for (const k of Object.keys(totals) as (keyof StatsRow)[]) totals[k] += l[k]
  return { days, currency: businesses[0].currency, totals, locations }
}

type StatsRow = {
  total: number
  collected: number
  scanned: number
  manual: number
  byCustomer: number
  expired: number
  cancelledByCustomer: number
  cancelledByPartner: number
  active: number
  deliveries: number
  bagsCollected: number
  revenueMinor: number
  expiredValueMinor: number
  arrivalWarnings: number
}

function emptyStats(): StatsRow {
  return { total: 0, collected: 0, scanned: 0, manual: 0, byCustomer: 0, expired: 0, cancelledByCustomer: 0, cancelledByPartner: 0, active: 0, deliveries: 0, bagsCollected: 0, revenueMinor: 0, expiredValueMinor: 0, arrivalWarnings: 0 }
}

function strip(row?: StatsRow & { _id: Types.ObjectId }): Partial<StatsRow> {
  if (!row) return {}
  const { _id: _ignored, ...rest } = row
  return rest
}
