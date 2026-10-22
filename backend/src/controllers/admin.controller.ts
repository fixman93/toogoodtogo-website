import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as adminService from '../services/admin.service.js'
import * as applicationService from '../services/application.service.js'
import * as auditService from '../services/audit.service.js'
import * as donationService from '../services/donation.service.js'
import * as statementService from '../services/statement.service.js'
import * as moderationService from '../services/partner-moderation.service.js'
import * as onboardingService from '../services/partner-onboarding.service.js'
import * as integrityService from '../services/integrity.service.js'
import * as staffService from '../services/staff.service.js'
import * as reservationService from '../services/reservation.service.js'
import { z } from 'zod'
import { list, ok } from '../utils/respond.js'
import {
  adminApplicationsQuery,
  adminBusinessesQuery,
  adminReservationsQuery,
  adminReviewsQuery,
  adminUsersQuery,
  applicationDecisionBody,
  auditQuery,
  blockBody,
  deletePartnerBody,
  monthQuery,
  partnerStatusBody,
  paymentBody,
  warningBody,
  reviewHiddenBody,
  roleBody,
  partnerContractBody,
} from '../validators/admin.validators.js'
import { idParams } from '../validators/common.js'

export async function getStats(_req: Request, res: Response) {
  ok(res, await adminService.stats())
}

export async function listUsers(req: Request, res: Response) {
  const result = await adminService.listUsers(adminUsersQuery.parse(req.query))
  list(res, result.items, result.meta)
}

export async function setRole(req: Request, res: Response) {
  const { id } = idParams.parse(req.params)
  ok(res, await adminService.setRole(id, roleBody.parse(req.body).role, currentUser(req)))
}

export async function listBusinesses(req: Request, res: Response) {
  const result = await adminService.listBusinesses(adminBusinessesQuery.parse(req.query))
  list(res, result.items, result.meta)
}

export async function setBlocked(req: Request, res: Response) {
  ok(res, await adminService.setBlocked(idParams.parse(req.params).id, blockBody.parse(req.body).blocked, currentUser(req)))
}

export async function listReservations(req: Request, res: Response) {
  const result = await adminService.listReservations(adminReservationsQuery.parse(req.query), currentUser(req))
  list(res, result.items, result.meta)
}

export async function listReviews(req: Request, res: Response) {
  const result = await adminService.listReviews(adminReviewsQuery.parse(req.query))
  list(res, result.items, result.meta)
}

export async function setReviewHidden(req: Request, res: Response) {
  ok(res, await adminService.setReviewHidden(idParams.parse(req.params).id, reviewHiddenBody.parse(req.body).hidden, currentUser(req)))
}

export async function listApplications(req: Request, res: Response) {
  const { status, page, limit } = adminApplicationsQuery.parse(req.query)
  const result = await applicationService.adminList(status, page, limit)
  list(res, result.items, result.meta)
}

export async function decideApplication(req: Request, res: Response) {
  ok(res, await applicationService.decide(idParams.parse(req.params).id, applicationDecisionBody.parse(req.body), currentUser(req)))
}

export async function listAudit(req: Request, res: Response) {
  const { page, limit } = auditQuery.parse(req.query)
  const result = await auditService.list(page, limit)
  list(res, result.items, result.meta)
}

export async function platformStatement(req: Request, res: Response) {
  ok(res, await statementService.platformStatement(monthQuery.parse(req.query).month))
}

export async function outstanding(_req: Request, res: Response) {
  ok(res, await statementService.outstanding())
}

export async function recordPayment(req: Request, res: Response) {
  ok(res, await statementService.recordPayment(paymentBody.parse(req.body), currentUser(req)), 201)
}

export async function deletePayment(req: Request, res: Response) {
  await statementService.deletePayment(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}

export async function partnerStats(req: Request, res: Response) {
  const { days } = z.object({ days: z.coerce.number().int().min(0).max(3650).default(30) }).parse(req.query)
  ok(res, await integrityService.partnerStats(idParams.parse(req.params).id, days))
}

export async function retryActivationMail(req: Request, res: Response) {
  ok(res, await onboardingService.retryActivationMail(idParams.parse(req.params).id, currentUser(req)))
}

export async function setPartnerContract(req: Request, res: Response) {
  ok(res, await onboardingService.setContract(idParams.parse(req.params).id, partnerContractBody.parse(req.body), currentUser(req)))
}

export async function partnerStanding(req: Request, res: Response) {
  ok(res, await moderationService.standing(idParams.parse(req.params).id))
}

export async function setPartnerStatus(req: Request, res: Response) {
  const { status, reason } = partnerStatusBody.parse(req.body)
  ok(res, await moderationService.setStatus(idParams.parse(req.params).id, status, reason, currentUser(req)))
}

export async function warnPartner(req: Request, res: Response) {
  ok(res, await moderationService.warn(idParams.parse(req.params).id, warningBody.parse(req.body).message, currentUser(req)), 201)
}

export async function resolveWarning(req: Request, res: Response) {
  ok(res, await moderationService.resolveWarning(idParams.parse(req.params).id, currentUser(req)))
}

export async function deletePartner(req: Request, res: Response) {
  await moderationService.remove(idParams.parse(req.params).id, deletePartnerBody.parse(req.body).reason, currentUser(req))
  res.status(204).end()
}

export async function setCommission(req: Request, res: Response) {
  const { rate } = z.object({ rate: z.number().min(0).max(0.5).nullable() }).parse(req.body)
  ok(res, await statementService.setCommission(idParams.parse(req.params).id, rate))
}

export async function listDonations(_req: Request, res: Response) {
  ok(res, await donationService.adminList())
}

export async function integrityAlerts(req: Request, res: Response) {
  ok(res, await reservationService.integrityAlerts(currentUser(req)))
}

export async function integrity(req: Request, res: Response) {
  const { days } = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }).parse(req.query)
  ok(res, await integrityService.platformIntegrity(days))
}

export async function listDisputes(req: Request, res: Response) {
  ok(res, await integrityService.openDisputes(currentUser(req)))
}

export async function resolveDispute(req: Request, res: Response) {
  const { decision, note } = z.object({ decision: z.enum(['upheld', 'rejected']), note: z.string().trim().max(500).optional() }).parse(req.body)
  ok(res, await reservationService.resolveDispute(idParams.parse(req.params).id, decision, note, currentUser(req)))
}

export async function getStaffAccess(req: Request, res: Response) {
  ok(res, await staffService.staffAccess(idParams.parse(req.params).id))
}

export async function setStaffAccess(req: Request, res: Response) {
  const { businessIds } = z.object({ businessIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(200) }).parse(req.body)
  ok(res, await staffService.setStaffAccess(idParams.parse(req.params).id, businessIds, currentUser(req)))
}
