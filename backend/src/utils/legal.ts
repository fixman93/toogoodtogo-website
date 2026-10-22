import { LEGAL_VERSIONS, REACCEPT_FROM, type LegalDocument } from '../config/legal.js'
import type { IUser, LegalAcceptance } from '../models/User.js'

type LegalUser = Pick<IUser, 'role'> & { legalAcceptances?: LegalAcceptance[] }

/** The newest acceptance of `document` (versions are dates, so they sort as strings). */
export function latestAcceptance(user: LegalUser, document: LegalDocument) {
  return (user.legalAcceptances ?? [])
    .filter((a) => a.document === document)
    .reduce<LegalAcceptance | undefined>((best, a) => (!best || a.version > best.version ? a : best), undefined)
}

/** What the app shows: current versions, what the user accepted, and whether it must ask again. */
export function legalStatus(user: LegalUser) {
  const terms = latestAcceptance(user, 'terms')
  const partner = latestAcceptance(user, 'partner_terms')
  return {
    termsVersion: LEGAL_VERSIONS.terms,
    privacyVersion: LEGAL_VERSIONS.privacy,
    termsAcceptedVersion: terms?.version ?? null,
    termsAcceptedAt: terms?.acceptedAt.toISOString() ?? null,
    // Existing users without a record are not asked unless a re-acceptance is configured.
    termsNeedsAcceptance: REACCEPT_FROM.terms != null && (!terms || terms.version < REACCEPT_FROM.terms),
    partnerTermsVersion: LEGAL_VERSIONS.partnerTerms,
    partnerTermsAcceptedVersion: partner?.version ?? null,
    partnerTermsAcceptedAt: partner?.acceptedAt.toISOString() ?? null,
    partnerTermsNeedsAcceptance: user.role === 'business' && (!partner || partner.version < REACCEPT_FROM.partnerTerms),
  }
}
