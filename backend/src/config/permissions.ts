import type { Role } from '../models/User.js'

/** Platform permissions. Partners/staff are scoped by location ownership instead. */
export const PERMISSIONS = [
  'stats.view',
  'users.view',
  'users.roles',
  'users.block',
  'applications.manage',
  'businesses.moderate',
  'partners.manage',
  'reservations.view',
  'reviews.moderate',
  'support.manage',
  'promotions.manage',
  'finance.view',
  'finance.manage',
  'donations.view',
  'audit.view',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  operations: [
    'stats.view',
    'users.view',
    'users.block',
    'applications.manage',
    'businesses.moderate',
    'partners.manage',
    'reservations.view',
    'reviews.moderate',
    'promotions.manage',
    'donations.view',
  ],
  support: ['stats.view', 'users.view', 'reservations.view', 'reviews.moderate', 'support.manage'],
  finance: ['stats.view', 'reservations.view', 'finance.view', 'finance.manage', 'donations.view'],
  business: [],
  staff: [],
  customer: [],
}

export const can = (role: Role | undefined, permission: Permission) => !!role && ROLE_PERMISSIONS[role].includes(permission)
export const permissionsFor = (role: Role) => [...ROLE_PERMISSIONS[role]]
