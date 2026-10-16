import type { Request, Response } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth.js'
import { TICKET_CATEGORIES, TICKET_STATUSES } from '../models/index.js'
import * as supportService from '../services/support.service.js'
import { list, ok } from '../utils/respond.js'
import { idParams, objectId, pagination } from '../validators/common.js'

const createBody = z.object({
  subject: z.string().trim().min(3).max(150),
  category: z.enum(TICKET_CATEGORIES).default('other'),
  message: z.string().trim().min(5).max(3000),
  reservationId: objectId.optional(),
})
const messageBody = z.object({ body: z.string().trim().min(1).max(3000) })
const adminQuery = z.object({ status: z.enum(TICKET_STATUSES).optional(), ...pagination, limit: z.coerce.number().int().min(1).max(100).default(50) })

export async function createTicket(req: Request, res: Response) {
  ok(res, await supportService.create(currentUser(req), createBody.parse(req.body)), 201)
}
export async function myTickets(req: Request, res: Response) {
  ok(res, await supportService.mine(currentUser(req)))
}
export async function getTicket(req: Request, res: Response) {
  ok(res, await supportService.get(idParams.parse(req.params).id, currentUser(req)))
}
export async function replyTicket(req: Request, res: Response) {
  ok(res, await supportService.reply(idParams.parse(req.params).id, messageBody.parse(req.body).body, currentUser(req)))
}
export async function closeTicket(req: Request, res: Response) {
  ok(res, await supportService.close(idParams.parse(req.params).id, currentUser(req)))
}
export async function adminTickets(req: Request, res: Response) {
  const { status, page, limit } = adminQuery.parse(req.query)
  const result = await supportService.adminList(status, page, limit)
  list(res, result.items, result.meta)
}
