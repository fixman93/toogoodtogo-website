import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as notificationService from '../services/notification.service.js'
import * as waitlistService from '../services/waitlist.service.js'
import { ok } from '../utils/respond.js'
import { idParams } from '../validators/common.js'

export async function listNotifications(req: Request, res: Response) {
  ok(res, await notificationService.list(currentUser(req)))
}

export async function unreadCount(req: Request, res: Response) {
  ok(res, await notificationService.unreadCount(currentUser(req)))
}

export async function markAllRead(req: Request, res: Response) {
  ok(res, await notificationService.markAllRead(currentUser(req)))
}

export async function markRead(req: Request, res: Response) {
  await notificationService.markRead(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}

export async function myWaitlist(req: Request, res: Response) {
  ok(res, await waitlistService.myOfferIds(currentUser(req)))
}

export async function joinWaitlist(req: Request, res: Response) {
  await waitlistService.join(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}

export async function leaveWaitlist(req: Request, res: Response) {
  await waitlistService.leave(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}
