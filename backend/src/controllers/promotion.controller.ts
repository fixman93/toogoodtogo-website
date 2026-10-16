import type { Request, Response } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth.js'
import { Offer, effectivePriceMinor } from '../models/index.js'
import * as promotionService from '../services/promotion.service.js'
import { ApiError } from '../utils/ApiError.js'
import { ok } from '../utils/respond.js'
import { idParams, objectId } from '../validators/common.js'

const createBody = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, 'Kod: 3–30 slova/brojeva bez razmaka'),
  description: z.string().trim().max(200).optional(),
  discountType: z.enum(['percent', 'fixed']),
  value: z.number().int().positive(),
  businessId: objectId.optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().min(1).max(100).optional(),
  platform: z.boolean().optional(),
})
const updateBody = z.object({
  isActive: z.boolean().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  validTo: z.coerce.date().nullable().optional(),
  description: z.string().trim().max(200).optional(),
})
const checkBody = z.object({ code: z.string().trim().min(2).max(30), offerId: objectId, quantity: z.number().int().min(1).max(20).default(1) })

export async function listPromotions(req: Request, res: Response) {
  const scope = z.enum(['mine', 'platform', 'all']).default('mine').parse(req.query.scope)
  ok(res, await promotionService.list(currentUser(req), scope))
}
export async function createPromotion(req: Request, res: Response) {
  ok(res, await promotionService.create(createBody.parse(req.body), currentUser(req)), 201)
}
export async function updatePromotion(req: Request, res: Response) {
  ok(res, await promotionService.update(idParams.parse(req.params).id, updateBody.parse(req.body), currentUser(req)))
}
export async function checkPromotion(req: Request, res: Response) {
  const input = checkBody.parse(req.body)
  const offer = await Offer.findById(input.offerId)
  if (!offer) throw ApiError.notFound('Ponuda nije pronađena.')
  ok(res, await promotionService.check({ code: input.code, quantity: input.quantity, offerPriceMinor: effectivePriceMinor(offer), businessId: offer.business }, currentUser(req)))
}
