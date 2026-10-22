/**
 * Versions of the legal documents and when users have to accept them again.
 * Keep in sync with src/config/legal.ts in the web app — it sends the versions
 * the user saw, and the API rejects an acceptance of an outdated version.
 */
import { env } from './env.js'

export const LEGAL_VERSIONS = {
  /** Uslovi korišćenja (/uslovi, /terms) — date of the version. */
  terms: '2026-10-19',
  /** Politika privatnosti (/privatnost, /privacy) — shown, not "accepted". */
  privacy: '2026-10-19',
  /**
   * Pravila za partnere (/partner-uslovi): "Pravni i operativni paket", verzija 2.0
   * od 22. 10. 2026. In the app the partner accepts Prilog C (operativna pravila);
   * the contract and Prilog A/B are signed outside the app (see `contract` on User).
   */
  partnerTerms: '2026-10-22',
} as const

/**
 * Re-acceptance: users whose last accepted version is older than this (or who
 * never accepted) are asked again in the app. `null` = nobody is asked — set it
 * only for a change that really needs new consent. Old acceptances are kept.
 */
export const REACCEPT_FROM: { terms: string | null; partnerTerms: string } = {
  terms: null,
  /** Partners always need an accepted partner-rules version at least this new. */
  partnerTerms: '2026-10-22',
}

/** Partners must accept the partner rules (Prilog C) in the app before they can publish offers. */
export const PARTNER_TERMS_REQUIRED_FOR_OFFERS = true
/**
 * Also require the contract (signed outside the app, recorded by the team) before publishing.
 * Off for now: existing partners have no recorded contract yet. Turn on once they are recorded.
 */
export const PARTNER_CONTRACT_REQUIRED_FOR_OFFERS = false

/** Public page with the partner rules (linked from e-mails). */
export const PARTNER_TERMS_PATH = '/partner-uslovi'
export const partnerTermsUrl = () => new URL(PARTNER_TERMS_PATH, env.APP_URL).toString()

export type LegalDocument = 'terms' | 'partner_terms'
