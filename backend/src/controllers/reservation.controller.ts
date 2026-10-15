import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as reservationService from '../services/reservation.service.js'
import { list, ok } from '../utils/respond.js'
import { idParams } from '../validators/common.js'
import { collectByCodeBody, createReservationBody, reservationListQuery } from '../validators/reservation.validators.js'

export async function listReservations(req: Request, res: Response) {
  const result = await reservationService.list(reservationListQuery.parse(req.query), currentUser(req))
  list(res, result.items, result.meta)
}

export async function getReservation(req: Request, res: Response) {
  ok(res, await reservationService.get(idParams.parse(req.params).id, currentUser(req)))
}

export async function createReservation(req: Request, res: Response) {
  ok(res, await reservationService.create(createReservationBody.parse(req.body), currentUser(req)), 201)
}

export async function cancelReservation(req: Request, res: Response) {
  ok(res, await reservationService.cancel(idParams.parse(req.params).id, currentUser(req)))
}

export async function collectReservation(req: Request, res: Response) {
  ok(res, await reservationService.collect(idParams.parse(req.params).id, currentUser(req)))
}

export async function collectByCode(req: Request, res: Response) {
  ok(res, await reservationService.collectByCode(collectByCodeBody.parse(req.body), currentUser(req)))
}
