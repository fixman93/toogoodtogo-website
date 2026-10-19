import { z } from 'zod'
import * as boostService from '../services/boost.service.js'
import { BOOST_KINDS } from '../models/index.js'
import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as offerService from '../services/offer.service.js'
import { list, ok } from '../utils/respond.js'
import { idParams } from '../validators/common.js'
import { createOfferBody, offerListQuery, offerLocationsQuery, updateOfferBody } from '../validators/offer.validators.js'

export async function listOffers(req: Request, res: Response) {
  const result = await offerService.list(offerListQuery.parse(req.query))
  list(res, result.items, result.meta)
}

export async function listOfferLocations(req: Request, res: Response) {
  ok(res, await offerService.locations(offerLocationsQuery.parse(req.query)))
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

export async function boostOptions(req: Request, res: Response) {
  ok(res, await boostService.options(idParams.parse(req.params).id, currentUser(req)))
}

export async function buyBoost(req: Request, res: Response) {
  const { kind } = z.object({ kind: z.enum(BOOST_KINDS) }).parse(req.body)
  ok(res, await boostService.buy(idParams.parse(req.params).id, kind, currentUser(req)), 201)
}
