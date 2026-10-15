import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as favoriteService from '../services/favorite.service.js'
import { list, ok } from '../utils/respond.js'
import { idParams } from '../validators/common.js'
import { createFavoriteBody } from '../validators/favorite.validators.js'

export async function listFavorites(req: Request, res: Response) {
  const result = await favoriteService.list(currentUser(req))
  list(res, result.items, result.meta)
}

export async function addFavorite(req: Request, res: Response) {
  const { created, favorite } = await favoriteService.add(createFavoriteBody.parse(req.body), currentUser(req))
  ok(res, favorite, created ? 201 : 200)
}

export async function removeFavorite(req: Request, res: Response) {
  await favoriteService.remove(idParams.parse(req.params).id, currentUser(req))
  res.status(204).end()
}
