import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as applicationService from '../services/application.service.js'
import * as reservationService from '../services/reservation.service.js'
import * as salesService from '../services/sales.service.js'
import * as staffService from '../services/staff.service.js'
import * as donationService from '../services/donation.service.js'
import * as integrationService from '../services/integration.service.js'
import * as statementService from '../services/statement.service.js'
import * as moderationService from '../services/partner-moderation.service.js'
import * as integrityService from '../services/integrity.service.js'
import * as suggestionService from '../services/suggestion.service.js'
import { z } from 'zod'
import { Business, WEBHOOK_EVENTS } from '../models/index.js'
import { partnerLocale } from '../services/access.service.js'
import { idParams, objectId } from '../validators/common.js'
import { ok } from '../utils/respond.js'
import { applicationBody, ordersQuery, salesQuery } from '../validators/partner.validators.js'

export async function getSales(req: Request, res: Response) {
  ok(res, await salesService.partnerSales(currentUser(req), salesQuery.parse(req.query)))
}

export async function listOrders(req: Request, res: Response) {
  const query = ordersQuery.parse(req.query)
  const actor = currentUser(req)
  const workplaceTz = actor.role === 'staff' && actor.staffOf?.[0] ? (await Business.findById(actor.staffOf[0]).select('timezone').lean())?.timezone : undefined
  const timezone = workplaceTz ?? (await partnerLocale(actor.id)).timezone
  const { date, start, end } = salesService.dayRange(query.date, timezone)
  const items = await reservationService.listForPartner(actor, { start, end, status: query.status, businessId: query.businessId })
  res.json({ data: items, meta: { date, total: items.length } })
}

export async function applyAsPartner(req: Request, res: Response) {
  ok(res, await applicationService.create(applicationBody.parse(req.body), currentUser(req)), 201)
}

export async function myApplication(req: Request, res: Response) {
  ok(res, await applicationService.mine(currentUser(req)))
}

export async function myWorkplaces(req: Request, res: Response) {
  ok(res, await staffService.myWorkplaces(currentUser(req)))
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM')

export async function suggestion(req: Request, res: Response) {
  const { businessId, date } = z.object({ businessId: objectId, date: ymd }).parse(req.query)
  ok(res, await suggestionService.suggestQuantity(businessId, date, currentUser(req)))
}

const donationBody = z.object({
  businessId: objectId,
  date: z.coerce.date(),
  organization: z.string().trim().min(2).max(120),
  bags: z.number().int().min(0).max(10000).default(0),
  weightKg: z.number().min(0).max(100000).optional(),
  items: z.string().trim().max(500).optional(),
  pickedUpBy: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
})
export async function listDonations(req: Request, res: Response) {
  ok(res, await donationService.mine(currentUser(req)))
}
export async function createDonation(req: Request, res: Response) {
  ok(res, await donationService.create(donationBody.parse(req.body), currentUser(req)), 201)
}
export async function deleteDonation(req: Request, res: Response) {
  await donationService.remove(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}

export async function statement(req: Request, res: Response) {
  const { month: m } = z.object({ month }).parse(req.query)
  ok(res, await statementService.partnerStatement(currentUser(req), m))
}

/** Months the partner hasn't settled yet. */
export async function outstanding(req: Request, res: Response) {
  ok(res, await statementService.outstanding(currentUser(req).id))
}

/** Account standing: paused/blocked status and warnings from the platform team. */
export async function standing(req: Request, res: Response) {
  ok(res, await moderationService.myStanding(currentUser(req).id))
}

export async function listApiKeys(req: Request, res: Response) {
  ok(res, await integrationService.listKeys(currentUser(req)))
}
export async function createApiKey(req: Request, res: Response) {
  const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(req.body)
  ok(res, await integrationService.createKey(currentUser(req), name), 201)
}
export async function revokeApiKey(req: Request, res: Response) {
  await integrationService.revokeKey(currentUser(req), idParams.parse(req.params).id)
  res.status(204).end()
}

const webhookBody = z.object({ url: z.url().max(500), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional() })
export async function listWebhooks(req: Request, res: Response) {
  ok(res, await integrationService.listWebhooks(currentUser(req)))
}
export async function createWebhook(req: Request, res: Response) {
  ok(res, await integrationService.createWebhook(currentUser(req), webhookBody.parse(req.body)), 201)
}
export async function updateWebhook(req: Request, res: Response) {
  const body = webhookBody.partial().extend({ isActive: z.boolean().optional() }).parse(req.body)
  ok(res, await integrationService.updateWebhook(currentUser(req), idParams.parse(req.params).id, body))
}
export async function deleteWebhook(req: Request, res: Response) {
  await integrationService.deleteWebhook(currentUser(req), idParams.parse(req.params).id)
  res.status(204).end()
}
export async function testWebhook(req: Request, res: Response) {
  ok(res, await integrationService.testWebhook(currentUser(req), idParams.parse(req.params).id))
}

const daysQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) })

/** Pickup statistics and customer-confirmed pickups to review. */
export async function integrity(req: Request, res: Response) {
  ok(res, await integrityService.partnerIntegrity(currentUser(req), daysQuery.parse(req.query).days))
}

const teamBody = z.object({
  email: z.email().trim().toLowerCase().optional(),
  businessIds: z.array(objectId).max(200),
})

/** Owner's staff and the locations each one sees. */
export async function team(req: Request, res: Response) {
  ok(res, await staffService.team(currentUser(req)))
}

/** Add a staff member by e-mail with chosen locations. */
export async function addTeamMember(req: Request, res: Response) {
  const body = teamBody.extend({ email: z.email().trim().toLowerCase() }).parse(req.body)
  ok(res, await staffService.setTeamMember(body, currentUser(req)), 201)
}

/** Change which locations a staff member sees (empty = remove). */
export async function updateTeamMember(req: Request, res: Response) {
  const { businessIds } = teamBody.parse(req.body)
  ok(res, await staffService.setTeamMember({ userId: idParams.parse({ id: req.params.userId }).id, businessIds }, currentUser(req)))
}
