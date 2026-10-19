import type { Request, Response } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth.js'
import * as scheduleService from '../services/schedule.service.js'
import { ok } from '../utils/respond.js'
import { idParams, objectId } from '../validators/common.js'
import { createScheduleBody, updateScheduleBody } from '../validators/schedule.validators.js'

const businessQuery = z.object({ businessId: objectId.optional() })

export async function listSchedules(req: Request, res: Response) {
  ok(res, await scheduleService.list(currentUser(req), businessQuery.parse(req.query).businessId))
}

export async function createSchedule(req: Request, res: Response) {
  ok(res, await scheduleService.create(createScheduleBody.parse(req.body), currentUser(req)), 201)
}

export async function updateSchedule(req: Request, res: Response) {
  ok(res, await scheduleService.update(idParams.parse(req.params).id, updateScheduleBody.parse(req.body), currentUser(req)))
}

export async function deleteSchedule(req: Request, res: Response) {
  await scheduleService.remove(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}

export async function recommendation(req: Request, res: Response) {
  ok(res, await scheduleService.recommendation(z.object({ businessId: objectId }).parse(req.query).businessId, currentUser(req)))
}
