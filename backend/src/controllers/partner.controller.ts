import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import * as applicationService from '../services/application.service.js'
import * as reservationService from '../services/reservation.service.js'
import * as salesService from '../services/sales.service.js'
import { ok } from '../utils/respond.js'
import { applicationBody, ordersQuery, salesQuery } from '../validators/partner.validators.js'

export async function getSales(req: Request, res: Response) {
  ok(res, await salesService.partnerSales(currentUser(req), salesQuery.parse(req.query)))
}

export async function listOrders(req: Request, res: Response) {
  const query = ordersQuery.parse(req.query)
  const { date, start, end } = salesService.dayRange(query.date, getMarket(env.DEFAULT_MARKET).timezone)
  const items = await reservationService.listForPartner(currentUser(req), { start, end, status: query.status, businessId: query.businessId })
  res.json({ data: items, meta: { date, total: items.length } })
}

export async function applyAsPartner(req: Request, res: Response) {
  ok(res, await applicationService.create(applicationBody.parse(req.body), currentUser(req)), 201)
}

export async function myApplication(req: Request, res: Response) {
  ok(res, await applicationService.mine(currentUser(req)))
}
