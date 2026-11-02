import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as rewardService from '../services/reward.service.js'
import { ok } from '../utils/respond.js'
import { redemptionIdParams } from '../validators/reward.validators.js'

export async function getCatalog(req: Request, res: Response) {
  ok(res, await rewardService.catalog(currentUser(req)))
}

export async function getMyRedemptions(req: Request, res: Response) {
  ok(res, await rewardService.myRedemptions(currentUser(req)))
}

export async function redeem(req: Request, res: Response) {
  ok(res, await rewardService.redeem(redemptionIdParams.parse(req.params).id, currentUser(req)))
}
