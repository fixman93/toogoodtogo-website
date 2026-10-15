import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as businessService from '../services/business.service.js'
import * as offerService from '../services/offer.service.js'
import * as reviewService from '../services/review.service.js'
import { list, ok } from '../utils/respond.js'
import { businessListQuery, createBusinessBody, updateBusinessBody } from '../validators/business.validators.js'
import { idParams } from '../validators/common.js'
import { manageOffersQuery } from '../validators/offer.validators.js'
import { createReviewBody, reviewListQuery } from '../validators/review.validators.js'

export async function listBusinesses(req: Request, res: Response) {
  const result = await businessService.list(businessListQuery.parse(req.query), req.user)
  list(res, result.items, result.meta)
}

export async function getBusiness(req: Request, res: Response) {
  ok(res, await businessService.get(idParams.parse(req.params).id, req.user))
}

export async function createBusiness(req: Request, res: Response) {
  ok(res, await businessService.create(createBusinessBody.parse(req.body), currentUser(req)), 201)
}

export async function updateBusiness(req: Request, res: Response) {
  ok(res, await businessService.update(idParams.parse(req.params).id, updateBusinessBody.parse(req.body), currentUser(req)))
}

export async function deleteBusiness(req: Request, res: Response) {
  await businessService.remove(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}

export async function listReviews(req: Request, res: Response) {
  const { page, limit } = reviewListQuery.parse(req.query)
  const result = await reviewService.list(idParams.parse(req.params).id, page, limit)
  list(res, result.items, result.meta)
}

export async function createReview(req: Request, res: Response) {
  ok(res, await reviewService.create(idParams.parse(req.params).id, createReviewBody.parse(req.body), currentUser(req)), 201)
}

export async function listBusinessOffers(req: Request, res: Response) {
  const { page, limit } = manageOffersQuery.parse(req.query)
  const result = await offerService.listForBusiness(idParams.parse(req.params).id, currentUser(req), page, limit)
  list(res, result.items, result.meta)
}
