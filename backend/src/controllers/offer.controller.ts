import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as offerService from '../services/offer.service.js'
import { list, ok } from '../utils/respond.js'
import { idParams } from '../validators/common.js'
import { createOfferBody, offerListQuery, updateOfferBody } from '../validators/offer.validators.js'

export async function listOffers(req: Request, res: Response) {
  const result = await offerService.list(offerListQuery.parse(req.query))
  list(res, result.items, result.meta)
}

export async function getOffer(req: Request, res: Response) {
  ok(res, await offerService.get(idParams.parse(req.params).id))
}

export async function createOffer(req: Request, res: Response) {
  ok(res, await offerService.create(createOfferBody.parse(req.body), currentUser(req)), 201)
}

export async function updateOffer(req: Request, res: Response) {
  ok(res, await offerService.update(idParams.parse(req.params).id, updateOfferBody.parse(req.body), currentUser(req)))
}

export async function deleteOffer(req: Request, res: Response) {
  await offerService.remove(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}
