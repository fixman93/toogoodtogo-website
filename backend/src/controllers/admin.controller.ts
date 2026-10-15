import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as adminService from '../services/admin.service.js'
import * as applicationService from '../services/application.service.js'
import * as auditService from '../services/audit.service.js'
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
  reviewHiddenBody,
  roleBody,
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
