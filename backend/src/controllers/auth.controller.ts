import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as authService from '../services/auth.service.js'
import { ok } from '../utils/respond.js'
import { loginBody, registerBody, roleBody } from '../validators/auth.validators.js'
import { idParams } from '../validators/common.js'

export async function register(req: Request, res: Response) {
  ok(res, await authService.register(registerBody.parse(req.body)), 201)
}

export async function login(req: Request, res: Response) {
  ok(res, await authService.login(loginBody.parse(req.body)))
}

export async function me(req: Request, res: Response) {
  ok(res, await authService.me(currentUser(req).id))
}

export async function setRole(req: Request, res: Response) {
  const { id } = idParams.parse(req.params)
  ok(res, await authService.setRole(id, roleBody.parse(req.body).role))
}
