import { z } from 'zod'
import { COURIER_MESSAGES, CUSTOMER_MESSAGES } from '../models/index.js'
import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as reservationService from '../services/reservation.service.js'
import { ApiError } from '../utils/ApiError.js'
import { list, ok } from '../utils/respond.js'
import { idParams } from '../validators/common.js'
import { collectByCodeBody, courierLocationBody, presenceBody, disputeBody, pickupCheckBody, createReservationBody, reservationListQuery } from '../validators/reservation.validators.js'

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

export async function verifyCode(req: Request, res: Response) {
  ok(res, await reservationService.verifyCode(collectByCodeBody.parse(req.body), currentUser(req)))
}

export async function shareReservation(req: Request, res: Response) {
  ok(res, await reservationService.share(idParams.parse(req.params).id, currentUser(req)))
}

export async function sharedPass(req: Request, res: Response) {
  const token = String(req.params.token ?? '')
  if (!/^[\w-]{10,64}$/.test(token)) throw ApiError.notFound('Link nije važeći.')
  ok(res, await reservationService.sharedPass(token))
}

export async function answerPickupCheck(req: Request, res: Response) {
  const { answer } = pickupCheckBody.parse(req.body)
  ok(res, await reservationService.answerPickupCheck(idParams.parse(req.params).id, answer, currentUser(req)))
}

export async function openDispute(req: Request, res: Response) {
  const { reason } = disputeBody.parse(req.body)
  ok(res, await reservationService.openDispute(idParams.parse(req.params).id, reason, currentUser(req)))
}

export async function startDelivery(req: Request, res: Response) {
  ok(res, await reservationService.startDelivery(idParams.parse(req.params).id, currentUser(req)))
}

export async function courierLocation(req: Request, res: Response) {
  ok(res, await reservationService.updateCourierLocation(idParams.parse(req.params).id, courierLocationBody.parse(req.body), currentUser(req)))
}

export async function courierArrived(req: Request, res: Response) {
  ok(res, await reservationService.courierArrived(idParams.parse(req.params).id, currentUser(req)))
}

export async function deliveryMessage(req: Request, res: Response) {
  const { key } = z.object({ key: z.enum([...COURIER_MESSAGES, ...CUSTOMER_MESSAGES]) }).parse(req.body)
  ok(res, await reservationService.deliveryMessage(idParams.parse(req.params).id, key, currentUser(req)))
}

export async function presence(req: Request, res: Response) {
  ok(res, await reservationService.recordPresence(idParams.parse(req.params).id, presenceBody.parse(req.body), currentUser(req)))
}
