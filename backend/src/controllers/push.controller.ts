import type { Request, Response } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth.js'
import * as pushService from '../services/push.service.js'
import { ok } from '../utils/respond.js'

const subscriptionBody = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(4) }),
})

export function publicKey(_req: Request, res: Response) {
  ok(res, pushService.publicKey())
}

export async function subscribe(req: Request, res: Response) {
  await pushService.subscribe(currentUser(req), subscriptionBody.parse(req.body), req.get('user-agent'))
  res.status(204).end()
}

export async function unsubscribe(req: Request, res: Response) {
  const { endpoint } = z.object({ endpoint: z.url() }).parse(req.body)
  await pushService.unsubscribe(currentUser(req), endpoint)
  res.status(204).end()
}
