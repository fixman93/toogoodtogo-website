import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as authService from '../services/auth.service.js'
import { ok } from '../utils/respond.js'
import { loginBody, registerBody } from '../validators/auth.validators.js'

export async function register(req: Request, res: Response) {
  ok(res, await authService.register(registerBody.parse(req.body)), 201)
}

export async function login(req: Request, res: Response) {
  ok(res, await authService.login(loginBody.parse(req.body)))
}

export async function me(req: Request, res: Response) {
  ok(res, await authService.me(currentUser(req).id))
}
