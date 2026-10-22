import { z } from 'zod'
import { impact } from '../services/loyalty.service.js'
import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as authService from '../services/auth.service.js'
import { ok } from '../utils/respond.js'
import { acceptLegalBody, deleteAccountBody, forgotPasswordBody, loginBody, preferencesBody, profileBody, registerBody, resetPasswordBody } from '../validators/auth.validators.js'

export async function register(req: Request, res: Response) {
  ok(res, await authService.register(registerBody.parse(req.body)), 201)
}

export async function acceptLegal(req: Request, res: Response) {
  ok(res, await authService.acceptLegal(currentUser(req).id, acceptLegalBody.parse(req.body)))
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

/** Download of everything stored about the signed-in user (GDPR access/portability). */
export async function exportMyData(req: Request, res: Response) {
  const data = await authService.exportMyData(currentUser(req).id)
  res.setHeader('Content-Disposition', `attachment; filename="foodnesi-moji-podaci-${new Date().toISOString().slice(0, 10)}.json"`)
  res.json({ data })
}

export async function myImpact(req: Request, res: Response) {
  const { year } = z.object({ year: z.coerce.number().int().min(2024).max(2100).optional() }).parse(req.query)
  ok(res, await impact(currentUser(req).id, year))
}
