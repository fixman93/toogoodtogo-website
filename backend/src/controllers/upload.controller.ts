import type { Request, Response } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth.js'
import { IMAGE_KINDS, putImage, storageEnabled } from '../services/storage.service.js'
import { ApiError } from '../utils/ApiError.js'
import { ok } from '../utils/respond.js'

const PARTNER_KINDS = new Set(['business-logo', 'business-cover', 'offer'])

/** POST /api/uploads?kind=… (multipart field "file") → { url } */
export async function uploadImage(req: Request, res: Response) {
  const kind = z.enum(IMAGE_KINDS).parse(req.query.kind)
  const actor = currentUser(req)
  if (PARTNER_KINDS.has(kind) && actor.role !== 'business' && actor.role !== 'admin') throw ApiError.forbidden()
  if (!req.file) throw ApiError.badRequest('Izaberi sliku.', 'NO_FILE')
  const { url, bytes } = await putImage(req.file.buffer, kind)
  ok(res, { url, bytes }, 201)
}

export function uploadStatus(_req: Request, res: Response) {
  ok(res, { enabled: storageEnabled() })
}
