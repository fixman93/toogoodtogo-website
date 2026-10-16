import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as authService from '../services/auth.service.js'
import { ok } from '../utils/respond.js'
import { deleteAccountBody, forgotPasswordBody, loginBody, preferencesBody, profileBody, registerBody, resetPasswordBody } from '../validators/auth.validators.js'

export async function register(req: Request, res: Response) {
  ok(res, await authService.register(registerBody.parse(req.body)), 201)
}

export async function login(req: Request, res: Response) {
  ok(res, await authService.login(loginBody.parse(req.body)))
}

export async function me(req: Request, res: Response) {
  ok(res, await authService.me(currentUser(req).id))
}

export async function deleteAccount(req: Request, res: Response) {
  await authService.deleteAccount(currentUser(req).id, deleteAccountBody.parse(req.body).password)
  res.status(204).end()
}

export async function updatePreferences(req: Request, res: Response) {
  ok(res, await authService.updatePreferences(currentUser(req).id, preferencesBody.parse(req.body)))
}

export async function updateProfile(req: Request, res: Response) {
  ok(res, await authService.updateProfile(currentUser(req).id, profileBody.parse(req.body)))
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.forgotPassword(forgotPasswordBody.parse(req.body).email)
  ok(res, { sent: true })
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = resetPasswordBody.parse(req.body)
  ok(res, await authService.resetPassword(token, password))
}
