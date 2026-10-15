import { Router } from 'express'
import * as c from '../controllers/favorite.controller.js'
import { authenticate } from '../middleware/auth.js'

export const favoriteRoutes = Router()
favoriteRoutes.use(authenticate)
favoriteRoutes.get('/', c.listFavorites)
favoriteRoutes.post('/', c.addFavorite)
favoriteRoutes.delete('/:id', c.removeFavorite)
