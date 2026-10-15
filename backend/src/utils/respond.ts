import type { Response } from 'express'

export interface PageMeta {
  page: number
  limit: number
  total: number
}

/** Consistent success envelope: { data } or { data, meta }. */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data })
}

export function list<T>(res: Response, data: T[], meta: PageMeta) {
  return res.status(200).json({ data, meta })
}
