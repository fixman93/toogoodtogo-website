import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import * as c from '../controllers/upload.controller.js'
import { authenticate } from '../middleware/auth.js'
import { ApiError } from '../utils/ApiError.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true)
    else cb(ApiError.badRequest('Dozvoljene su samo slike.', 'INVALID_IMAGE'))
  },
})

const uploadLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Previše otpremanja. Pokušaj ponovo za nekoliko minuta.' } },
})

export const uploadRoutes = Router()
uploadRoutes.get('/status', c.uploadStatus)
uploadRoutes.post('/', authenticate, uploadLimiter, upload.single('file'), c.uploadImage)
