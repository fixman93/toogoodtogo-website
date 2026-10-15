import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as salesService from '../services/sales.service.js'
import { ok } from '../utils/respond.js'
import { salesQuery } from '../validators/partner.validators.js'

export async function getSales(req: Request, res: Response) {
  ok(res, await salesService.partnerSales(currentUser(req), salesQuery.parse(req.query)))
}
