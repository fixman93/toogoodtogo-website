import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'
import * as adminService from '../services/admin.service.js'
import { list, ok } from '../utils/respond.js'
import { adminBusinessesQuery, adminUsersQuery, roleBody } from '../validators/admin.validators.js'
import { idParams } from '../validators/common.js'

export async function getStats(_req: Request, res: Response) {
  ok(res, await adminService.stats())
}

export async function listUsers(req: Request, res: Response) {
  const result = await adminService.listUsers(adminUsersQuery.parse(req.query))
  list(res, result.items, result.meta)
}

export async function setRole(req: Request, res: Response) {
  const { id } = idParams.parse(req.params)
  ok(res, await adminService.setRole(id, roleBody.parse(req.body).role, currentUser(req)))
}

export async function listBusinesses(req: Request, res: Response) {
  const result = await adminService.listBusinesses(adminBusinessesQuery.parse(req.query))
  list(res, result.items, result.meta)
}
